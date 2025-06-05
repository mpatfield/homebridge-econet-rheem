import axios, { AxiosRequestConfig, AxiosResponse, isAxiosError } from 'axios';
import mqtt from 'mqtt';

import { Auth } from './auth.js';
import { EquipmentType } from './constants.js';
import { Equipment } from './equipment.js';
import * as Types from './types.js';

import { Thermostat } from './thermostat.js';
import { WaterHeater } from './waterHeater.js';

import { strings } from '../i18n/i18n.js';

import { safeGetItem, safeSetItem, STORAGE_KEY_MQTT } from '../tools/storage.js';
import { MINUTE, SECOND } from '../tools/time.js';
import { Log, LogType } from '../tools/log.js';

const CLEAR_BLADE_SYSTEM_KEY = 'e2e699cb0bb0bbb88fc8858cb5a401';
const CLEAR_BLADE_SYSTEM_SECRET = 'E2E699CB0BE6C6FADDB1B0BC9A20';
const BASE_HEADERS = {
  'ClearBlade-SystemKey': CLEAR_BLADE_SYSTEM_KEY,
  'ClearBlade-SystemSecret': CLEAR_BLADE_SYSTEM_SECRET,
  'Content-Type': 'application/json; charset=UTF-8',
};

const HOST = 'rheem.clearblade.com';
const BASE_URL = `https://${HOST}/api/v/1`;
const AUTH_URL = `${BASE_URL}/user/auth`;
const LOCATIONS_URL = `${BASE_URL}/code/${CLEAR_BLADE_SYSTEM_KEY}/getUserDataForApp`;

const MQTT_URL = `mqtts://${HOST}:1884`;
const MQTT_TOPIC_REPORTED = 'user/%s/device/reported';
const MQTT_TOPIC_DESIRED = 'user/%s/device/desired';

const HTTP_TIMEOUT = 10 * SECOND;
const MQTT_KEEPALIVE = 90;

const DELAYS = [5 * SECOND, 15 * SECOND, MINUTE, 2 * MINUTE, 5 * MINUTE];
const IDLE_CONNECTION_TIMER_INTERVAL = 16 * MINUTE;

const HTTP_RETRY_CODES = [
  'ERR_NETWORK',  // General network error in Axios
  'ETIMEDOUT',    // Request timed out
  'ECONNREFUSED', // Connection refused by server
  '429',          // Too Many Requests (rate limit)
  '500',          // Internal Server Error
  '502',          // Bad Gateway
  '503',          // Service Unavailable
  '504',          // Gateway Timeout
];

export class EconetApi {
  private _auth?: Auth | null;
  private retryIndex: number = 0;

  readonly equipments: Map<string, Equipment> = new Map();

  private mqttClient: mqtt.MqttClient | null = null;
  private shouldReconnect = false;
  private isReconnecting = false;
  private reconnectCount = 0;
  private idleMQTTTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly log: Log,
    private readonly email: string,
    private readonly password: string,
    readonly storageFilePath: string,
    private readonly debugMQTT: boolean,
  ) {
    this.auth = Auth.load(this.storageFilePath, email);
  }

  static async connect(log: Log, email: string, password: string, storageFilePath: string, debugMQTT: boolean): Promise<EconetApi> {
    const api = new EconetApi(log, email, password, storageFilePath, debugMQTT);

    let shouldContinue = true;
    if (!api.auth) {
      shouldContinue = await api.authenticate();
    }

    if (shouldContinue) {
      await api.getLocations();

      api.shouldReconnect = true;
      api.mqttConnect(true);
    }

    return api;
  }

  teardown(): void {
    this.shouldReconnect = false;
    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }
  }

  publish(payload: { [key: string]: number }, deviceId: string, serialNumber: string): void {
    
    if (!this.mqttClient || !this.mqttClient.connected) {
      this.log.error(strings.mqtt.notConnected);
      return;
    }

    if (!this.auth?.accountId) {
      this.log.error(strings.mqtt.authMissing);
      return;
    }

    const dateTime = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const transactionId = `ANDROID_${dateTime}`;

    const data = {
      transactionId,
      device_name: deviceId,
      serial_number: serialNumber,
      ...payload,
    };

    const topic = MQTT_TOPIC_DESIRED.replace('%s', this.auth.accountId);
    const message = JSON.stringify(data);

    this.mqttClient.publish(topic, message);

    this.logDebug(this.publish.name, topic, data);
  }

  private get auth(): Auth | null {
    return this._auth ?? null;
  }
  
  private set auth(value: Auth | null) {
    this._auth = value;

    if (this._auth) {
      this._auth.save(this.storageFilePath, this.email);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async httpRequest<T = any>(
    caller: string, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any | null, 
    url: string, 
    ...parameters: (string|undefined)[]
  ):  Promise<T | null> {

    parameters.forEach(param => {
      url = url.replace('%s', param ?? '');
    });

    let config: AxiosRequestConfig;
    if (this.auth?.token) {
      const headers = { ...BASE_HEADERS, 'ClearBlade-UserToken': this.auth?.token };
      config = { headers: headers, timeout: HTTP_TIMEOUT };
    } else {
      config = { headers: BASE_HEADERS, timeout: HTTP_TIMEOUT };
    }

    try {

      let res: AxiosResponse<T>;
      if (data) {
        res = await axios.post(url, data, config);
      } else {
        res = await axios.get(url, config);
      }

      if (!res.data) {
        this.log.warning(caller, this.desensitize(res.data));
        throw new Error(strings.http.noDataReceived);
      }

      this.logDebug(caller, url.substring(BASE_URL.length + 1), res.data);
      this.retryIndex = 0;

      return res.data;

    } catch (err: unknown) {
      return this.retryHTTPIfPossible<T>(err, caller, () => this.httpRequest<T>(caller, data, url, ...parameters));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async retryHTTPIfPossible<T = any>(err: unknown, caller: string, retry: () => (Promise<T | null>)): Promise<T | null> {

    if (!isAxiosError(err)) {
      this.log.warning((err as Error).message);
      return null;
    }
  
    const errorCode = err.code || err.response?.status?.toString() || 'UNKNOWN';

    if (!HTTP_RETRY_CODES.includes(errorCode) || this.retryIndex >= DELAYS.length) {
      this.log.warning(err.message);
      return null;
    }
    
    const retryDelay = DELAYS[Math.min(this.retryIndex, DELAYS.length - 1)];
    if (retryDelay <= MINUTE) {
      this.log.ifVerbose(strings.http.retryInSeconds, retryDelay / SECOND);
    } else {
      this.log.ifVerbose(strings.http.retryInMinutes, retryDelay / MINUTE);
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));

    this.retryIndex += 1;

    return await retry();
  }

  private async authenticate(): Promise<boolean> {

    const data = { email: this.email, password: this.password };
    const tokenData = await this.httpRequest<Types.TokenData>(this.authenticate.name, data, AUTH_URL);

    if (!tokenData) {
      return false;
    } 
    
    this.auth = new Auth(tokenData);

    this.log.always(strings.http.authSuccess);

    return true;
  }

  private mqttConnect(isStartup: boolean = false): void {
    
    if (!this.equipments.size) {
      return;
    }
  
    if (!this.auth?.token) {
      this.log.error(strings.mqtt.authMissing);
      return;
    }

    const timeString = Date.now().toString().replace('.', '').slice(0, 13);
    const clientId = `${this.email}${timeString}_android`;

    const options = {
      clientId,
      username: this.auth.token,
      password: CLEAR_BLADE_SYSTEM_KEY,
      rejectUnauthorized: true,
      keepalive: MQTT_KEEPALIVE,
      reconnectPeriod: 0,
    };

    this.mqttClient = mqtt.connect(MQTT_URL, options);

    this.mqttClient.on('connect', () => this.mqttSubscribe(isStartup) );

    this.mqttClient.on('message', (topic, message) => this.mqttMessageReceived(topic, message.toString()));

    this.mqttClient.on('close', () => this.mqttConnectionClosed());

    this.mqttClient.on('error', (error: Types.MQTTError) => this.log.ifVerbose(LogType.WARNING, strings.mqtt.clientError, error));
  }

  private mqttSubscribe(isStartup: boolean) {
    
    if (!this.mqttClient || !this.auth?.accountId) {
      this.log.error(strings.mqtt.connectionError);
      return;
    }
      
    this.mqttClient.subscribe(MQTT_TOPIC_REPORTED.replace('%s', this.auth.accountId));
    this.mqttClient.subscribe(MQTT_TOPIC_DESIRED.replace('%s', this.auth.accountId));
      
    this.log.always(strings.mqtt.connected);

    if (isStartup) {
      const randIndex = Math.floor(Math.random() * strings.startup.welcome.length);
      this.log.always(strings.startup.setupComplete, strings.startup.welcome[randIndex]);
    }
  }

  private mqttMessageReceived(topic: string, message: string) {

    this.reconnectCount = 0;
    this.resetIdleMQTTTimer();

    try {

      const data = JSON.parse(message) as Types.MQTTData;

      const equipment = data.serial_number ? this.equipments.get(data.serial_number) : null;
      if (equipment) {

        this.logDebug(this.mqttMessageReceived.name, topic, data);

        equipment.updateFromMQTT(data);

        if (this.debugMQTT) {
          this.saveMQTT(data);
        }
      }
    } catch (e) {
      this.log.warning(strings.mqtt.parseFailed, this.desensitize(message));
    }
  }

  private mqttConnectionClosed() {
    this.log.ifVerbose(strings.mqtt.connectionClosed);
    this.mqttReconnect();
  }

  private resetIdleMQTTTimer() {

    if (this.idleMQTTTimer) {
      clearTimeout(this.idleMQTTTimer);
    }

    this.idleMQTTTimer = setTimeout(()=>{
      this.log.ifVerbose(strings.mqtt.idleConnection);
      this.mqttReconnect();
    }, IDLE_CONNECTION_TIMER_INTERVAL); 
  }

  private async mqttReconnect() {

    if (!this.shouldReconnect || this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;

    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }

    this.reconnectCount++;
    if (this.reconnectCount % DELAYS.length === 0) {
      try {
        this.log.ifVerbose(strings.mqtt.unstableConnection);
        this.log.ifVerbose(strings.http.reauthenticate);
        await this.authenticate();
      } catch (error) {
        this.log.ifVerbose(strings.http.reauthFailed, error);
      }
    }

    const reconnectDelay = DELAYS[Math.min(this.reconnectCount, DELAYS.length - 1)];
    if (reconnectDelay < MINUTE) {
      this.log.ifVerbose(strings.mqtt.reconnectInSeconds, reconnectDelay / SECOND);
    } else {
      this.log.ifVerbose(strings.mqtt.reconnectInMinutes, reconnectDelay / MINUTE);
    }

    setTimeout(() => {
      this.isReconnecting = false;
      this.mqttConnect();
    }, reconnectDelay);
  }

  private async getLocations(): Promise<void> {
      
    const data = {
      location_only: false,
      type: 'com.econet.econetconsumerandroid',
      version: '6.0.0-375-01b4870e',
    };

    const locationsData = await this.httpRequest<Types.LocationsResponse>(this.getLocations.name, data, LOCATIONS_URL);
    if (!locationsData) {
      return;
    }

    locationsData.results.locations.forEach(location => {
      location.equiptments.forEach(equipmentData => {

        let equipment: Equipment | null = null;
        switch(equipmentData.device_type) {
        case EquipmentType.THERMOSTAT:
          equipment = new Thermostat(this, equipmentData as unknown as Types.ThermostatData);
          break;
        case EquipmentType.WATER_HEATER:
          equipment = new WaterHeater(this, equipmentData as unknown as Types.WaterHeaterData, this.storageFilePath);
          break;
        default:
          this.log.error(strings.equipment.unsupported, equipmentData.device_type);
        }

        if (equipment) {
          this.equipments.set(equipment.serialNumber, equipment);

          if (equipmentData.device_type === EquipmentType.THERMOSTAT && equipmentData.zoning_devices) {
            equipmentData.zoning_devices.forEach(zoningEquipmentData => {
              const zoningEquip = new Thermostat(this, zoningEquipmentData);
              this.equipments.set(zoningEquip.serialNumber, zoningEquip);
            });
          }
        }
      });
    });
  }

  private saveMQTT(data: Types.MQTTData) {

    const ignoreKeys = new Set(['transactionId', 'device_name', 'serial_number']);

    const objectString = safeGetItem(this.storageFilePath, STORAGE_KEY_MQTT);
    const valuesObject = objectString ? JSON.parse(objectString) : {};

    for (const [key, value] of Object.entries(data)) {

      if (ignoreKeys.has(key) || value.toString.length === 0) {
        continue;
      }

      let valuesArray = valuesObject[key] ?? [];

      const valuesSet = new Set(valuesArray);
      valuesSet.add(value);

      valuesArray = Array.from(valuesSet);

      valuesObject[key] = valuesArray;
    }

    safeSetItem(this.storageFilePath, STORAGE_KEY_MQTT, JSON.stringify(valuesObject));
  }

  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logDebug(caller: string, message: string, data: any) {
    if (this.log.verbose) {
      this.log.ifVerbose(`${caller}() —`, this.desensitize(message), `\n${this.desensitize(data)}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private desensitize(data: any): string {

    let output: string;
    
    if (typeof data === 'string') {
      output = data;

    } else {
      output = JSON.stringify(data);

      Types.SENSITIVE_KEYS.forEach(key => {
        const regex = new RegExp(`"${key}"\\s*:\\s*(".*?"|\\d+|true|false|null)`, 'gi');
        output = output.replace(regex, `"${key}": "${strings.general.redacted}"`);
      });
    }

    if (this.auth) {
      output = output.replaceAll(this.auth.accountId, strings.general.redacted);
      output = output.replaceAll(this.auth.token, strings.general.redacted);
      output = output.replaceAll(this.auth.userId, strings.general.redacted);
    }

    return output;
  }
}
