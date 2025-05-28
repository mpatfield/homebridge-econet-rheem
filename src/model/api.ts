import { Logger } from 'homebridge';

import mqtt from 'mqtt';
import path from 'path';

import { Equipment } from './equipment.js';
import { WaterHeater } from './waterHeater.js';
import { Thermostat } from './thermostat.js';
import { MINUTE, safeGetItem, safeSetItem, SECOND } from './utils.js';

import strings from '../lang/en.js';

const HOST = 'rheem.clearblade.com';
const REST_URL = `https://${HOST}/api/v/1`;
const CLEAR_BLADE_SYSTEM_KEY = 'e2e699cb0bb0bbb88fc8858cb5a401';
const CLEAR_BLADE_SYSTEM_SECRET = 'E2E699CB0BE6C6FADDB1B0BC9A20';
const HEADERS = {
  'ClearBlade-SystemKey': CLEAR_BLADE_SYSTEM_KEY,
  'ClearBlade-SystemSecret': CLEAR_BLADE_SYSTEM_SECRET,
  'Content-Type': 'application/json; charset=UTF-8',
};

const RECONNECT_DELAYS = [5 * SECOND, 15 * SECOND, MINUTE, 2 * MINUTE, 5 * MINUTE];
const IDLE_CONNECTION_TIMER_INTERVAL = 16 * MINUTE;

const RETRYABLE_CODES = [
  3, // MQTT: Server unavailable
  'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET',
  'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH',
];

const MQTT_DEBUG_FILE_NAME = 'mqttDebug.json';

export const WATER_HEATER = 'WH';
export const THERMOSTAT = 'HVAC';

export class PyeconetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PyeconetError';
  }
}

export class InvalidCredentialsError extends PyeconetError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidResponseFormat extends PyeconetError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResponseFormat';
  }
}

export class GenericHTTPError extends PyeconetError {
  constructor(message: string) {
    super(message);
    this.name = 'GenericHTTPError';
  }
}

interface MqttError extends Error {
  code?: string | number;
}

export class EconetApi {
  private mqttOptions: mqtt.IClientOptions | null = null;
  private userToken: string | null = null;
  private accountId: string | null = null;
  private equipment: Map<string, Equipment> = new Map();
  private mqttClient: mqtt.MqttClient | null = null;
  private shouldReconnect = false;
  private isReconnecting = false;
  private reconnectCount = 0;
  private idleMQTTTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly log: Logger,
    private readonly email: string,
    private readonly password: string,
    readonly storagePath: string,
    private readonly verbose: boolean,
    private readonly debugMQTT: boolean,
  ) {}

  static async login(log: Logger, email: string, password: string, storagePath: string, verbose: boolean, debugMQTT: boolean): Promise<EconetApi> {
    const api = new EconetApi(log, email, password, storagePath, verbose, debugMQTT);
    await api.authenticate();
    return api;
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${REST_URL}/user/auth`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    if (response.status === 200) {
      const json = await response.json();
      if (json.options.success) {
        this.log.info(strings.authSuccess);

        this.userToken = json.user_token;
        this.accountId = json.options.account_id;

        const timeString = Date.now().toString().replace('.', '').slice(0, 13);
        const clientId = `${this.email}${timeString}_android`;

        this.mqttOptions = {
          clientId,
          username: this.userToken!,
          password: CLEAR_BLADE_SYSTEM_KEY,
          rejectUnauthorized: true,
          keepalive: 90,
          reconnectPeriod: 0,
        };
      } else {
        throw new InvalidCredentialsError(json.options.message || strings.invalidCredentials);
      }
    } else {
      throw new GenericHTTPError(`${strings.httpError} ${response.status}`);
    }
  }

  subscribe() {
    this.shouldReconnect = true;
    this.connect(true);
  }

  private connect(isStartup: boolean = false): void {
    
    if (!this.equipment.size) {
      this.log.error(strings.noEquipment);
      return;
    }

    if (!this.mqttOptions) {
      this.log.error(strings.noMQTTOptions);
      return;
    }

    this.mqttClient = mqtt.connect(`mqtts://${HOST}:1884`, this.mqttOptions);

    this.mqttClient.on('connect', () => {
      this.mqttClient!.subscribe(`user/${this.accountId}/device/reported`);
      this.mqttClient!.subscribe(`user/${this.accountId}/device/desired`);
      this.log.info(strings.connected);

      if (isStartup) {
        const randIndex = Math.floor(Math.random() * strings.welcomeMessages.length);
        this.log.info(strings.setupComplete, strings.welcomeMessages[randIndex]);
      }
    });

    this.mqttClient.on('message', (topic, message) => {
      this.reconnectCount = 0;
      this.resetIdleMQTTTimer();
      try {
        const unpackedJson = JSON.parse(message.toString());
        if (this.verbose) {
          this.log.info(strings.topicUpdate, topic, JSON.stringify(unpackedJson));
        }
        const serial = unpackedJson.serial_number;
        const equipment = this.equipment.get(serial);
        if (equipment) {
          equipment.updateFromMQTT(unpackedJson);
          if (this.debugMQTT) {
            this.saveMQTT(unpackedJson);
          }
        }
      } catch (e) {
        this.log.error(strings.parseFailed, message.toString());
      }
    });

    this.mqttClient.on('offline', () => {
      this.log.debug(strings.clientOffline);
    });

    this.mqttClient.on('close', () => {
      this.log.info(strings.connectionClosed);
      this.reconnect();
    });

    this.mqttClient.on('error', (err: MqttError) => {
      if (err.code !== undefined && RETRYABLE_CODES.includes(err.code)) {
        if (this.verbose) {
          this.log.error(strings.clientError, err);
        }
        this.reconnect();
      } else {
        this.log.error(strings.clientError, err);
      }
    });
  }

  private resetIdleMQTTTimer() {

    if (this.idleMQTTTimer) {
      clearTimeout(this.idleMQTTTimer);
    }

    this.idleMQTTTimer = setTimeout(()=>{
      this.log.info(strings.idleConnection);
      this.reconnect();
    }, IDLE_CONNECTION_TIMER_INTERVAL); 
  }

  private async reconnect() {

    if (!this.shouldReconnect || this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;

    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }

    this.reconnectCount++;
    if (this.reconnectCount % RECONNECT_DELAYS.length === 0) {
      try {
        this.log.error(strings.unstableConnection);
        this.log.info(strings.reauthenticate);
        await this.authenticate();
      } catch (error) {
        this.log.error(strings.reauthFailed, error);
      }
    }

    const reconnectDelay = RECONNECT_DELAYS[Math.min(this.reconnectCount, RECONNECT_DELAYS.length - 1)];
    if (reconnectDelay <= MINUTE) {
      this.log.info(strings.reconnectInSeconds, reconnectDelay / SECOND);
    } else {
      this.log.info(strings.reconnectInMinutes, reconnectDelay / MINUTE);
    }

    setTimeout(() => {
      this.isReconnecting = false;
      this.connect();
    }, reconnectDelay);
  }

  publish(payload: { [key: string]: number }, deviceId: string, serialNumber: string): void {

    const dateTime = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const transactionId = `ANDROID_${dateTime}`;
    const publishPayload = {
      transactionId,
      device_name: deviceId,
      serial_number: serialNumber,
      ...payload,
    };
    
    if (!this.mqttClient || !this.mqttClient.connected) {
      this.log.error(strings.clientNotConnected);
      return;
    }

    const topic = `user/${this.accountId}/device/desired`;
    const message = JSON.stringify(publishPayload, null, 2);
    if (this.verbose) {
      this.log.info(strings.topicPublish, topic, message);
    }
    this.mqttClient.publish(topic, message);
  }

  unsubscribe(): void {
    this.shouldReconnect = false;
    if (this.mqttClient) {
      this.mqttClient.end();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getLocation(): Promise<any[]> {
    const headers = { ...HEADERS, 'ClearBlade-UserToken': this.userToken! };
    const payload = {
      location_only: false,
      type: 'com.econet.econetconsumerandroid',
      version: '6.0.0-375-01b4870e',
    };
    const response = await fetch(`${REST_URL}/code/${CLEAR_BLADE_SYSTEM_KEY}/getUserDataForApp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (response.status === 200) {
      const json = await response.json();
      if (json.success) {
        return json.results.locations;
      }
      throw new InvalidResponseFormat(strings.invalidResponse);
    }
    throw new GenericHTTPError(`${strings.httpError} ${response.status}`);
  }

  async getEquipment(): Promise<void> {
    const locations = await this.getLocation();
    for (const location of locations) {
      for (const equip of location.equiptments) {
        if ('error' in equip) {
          this.log.error(strings.equipmentError, equip.error);
          continue;
        }

        if (this.verbose) {
          this.log.info(strings.creatingEquipment, JSON.stringify(equip));
        }

        let equipObj: Equipment;
        if (equip.device_type === WATER_HEATER) {
          equipObj = new WaterHeater(this, equip);
        } else if (equip.device_type === THERMOSTAT) {
          equipObj = new Thermostat(this, equip);
        } else {
          continue;
        }

        this.equipment.set(equipObj.serialNumber, equipObj);
        if (equip.device_type === THERMOSTAT && equip.zoning_devices) {
          for (const zoningDevice of equip.zoning_devices) {
            const zoningEquip = new Thermostat(this, zoningDevice);
            this.equipment.set(zoningEquip.serialNumber, zoningEquip);
          }
        }
      }
    }
  }

  async getEquipmentByType(types: string[]): Promise<Map<string, Equipment[]>> {
    if (!this.equipment.size) {
      await this.getEquipment();
    }
    const result = new Map<string, Equipment[]>();
    types.forEach((type) => result.set(type, []));
    for (const equip of this.equipment.values()) {
      if (types.includes(equip instanceof WaterHeater ? WATER_HEATER : THERMOSTAT)) {
        result.get(equip instanceof WaterHeater ? WATER_HEATER : THERMOSTAT)!.push(equip);
      }
    }
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private saveMQTT(json: any) {

    const filePath = path.join(this.storagePath, MQTT_DEBUG_FILE_NAME);
    const ignoreKeys = new Set(['transactionId', 'device_name', 'serial_number']);

    for (const [key, value] of Object.entries(json)) {

      if (ignoreKeys.has(key)) {
        continue;
      }

      let valuesString = safeGetItem(filePath, key);
      let valuesArray = valuesString ? JSON.parse(valuesString) : [];
      const valuesSet = new Set(valuesArray);

      valuesSet.add(value);

      valuesArray = Array.from(valuesSet);
      valuesString = JSON.stringify(valuesArray);

      safeSetItem(filePath, key, valuesString);
    }
  }
}
