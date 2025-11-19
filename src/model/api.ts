import axios, { AxiosRequestConfig, AxiosResponse, isAxiosError } from 'axios';

import { DeviceAuth, UserAuth } from './auth.js';
import { EquipmentType } from './constants.js';
import { Equipment } from './equipment.js';
import { EconetMQTT } from './mqtt.js';
import { DeviceTokenData, LocationsResponse, ThermostatData, UserTokenData, WaterHeaterData } from './types.js';

import { Thermostat } from './thermostat.js';
import { WaterHeater } from './waterHeater.js';

import { strings } from '../i18n/i18n.js';

import { CLEARBLADE_HOST, CLEARBLADE_KEY, CLEARBLADE_SECRET } from '../homebridge/settings.js';

import { DELAYS, MINUTE, SECOND } from '../tools/time.js';
import { Log } from '../tools/log.js';

const BASE_HEADERS = {
  'ClearBlade-SystemKey': CLEARBLADE_KEY,
  'ClearBlade-SystemSecret': CLEARBLADE_SECRET,
  'Content-Type': 'application/json; charset=UTF-8',
};

const BASE_URL_V1 = `https://${CLEARBLADE_HOST}/api/v/1`;
const BASE_URL_V2 = `https://${CLEARBLADE_HOST}/api/v/2`;
const AUTH_URL = `${BASE_URL_V1}/user/auth`;
const AUTH_DEVICE_URL = `${BASE_URL_V2}/devices/${CLEARBLADE_KEY}/auth`;
const LOCATIONS_URL = `${BASE_URL_V1}/code/${CLEARBLADE_KEY}/getUserDataForApp`;

const HTTP_TIMEOUT = 10 * SECOND;

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

type DeviceDetails = { serialNumber: string, deviceName: string, activeKey: string }

export class EconetApi {
  private userAuth?: UserAuth;
  private retryIndex: number = 0;

  readonly equipments: Map<string, Equipment> = new Map();

  private userClient?: EconetMQTT;
  private deviceClients: EconetMQTT[] = [];

  constructor(
    public readonly log: Log,
    private readonly email: string,
    private readonly password: string,
    private readonly devices: DeviceDetails[],
    private readonly debugMQTT: boolean,
  ) {}

  static async connect(log: Log, email: string, password: string, devices: DeviceDetails[], debugMQTT: boolean): Promise<EconetApi> {
    const api = new EconetApi(log, email, password, devices, debugMQTT);

    api.userAuth = UserAuth.load(email);

    let shouldContinue = true;
    if (!api.userAuth) {
      shouldContinue = await api.authenticateUser();
    }

    if (shouldContinue) {
      await api.getLocations();

      for (const equipment of api.equipments.values()) {
        const device = devices.find( (device) => device.serialNumber === equipment.serialNumber);
        if (device !== undefined && DeviceAuth.load(device.serialNumber, email) === undefined) {
          await api.authenticateDevice(device.serialNumber, device.deviceName, device.activeKey);
        }
      }

      api.setupMQTTConnections();
    }

    return api;
  }

  teardown(): void {
    this.userClient?.teardown();
    this.userClient = undefined;

    while (this.deviceClients.length > 0) {
      const client = this.deviceClients.shift();
      client?.teardown();
    }
  }

  publish(payload: { [key: string]: number }, deviceId: string, serialNumber: string): void {
    
    if (!this.userClient) {
      this.log.error(strings.mqtt.userNotConnected);
      return;
    }

    if (!this.userAuth?.accountId) {
      this.log.error(strings.mqtt.userAuthMissing);
      return;
    }

    this.userClient.publish(this.userAuth.accountId, payload, deviceId, serialNumber);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async httpRequest<T = any>(
    caller: string, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any | undefined, 
    url: string, 
    ...parameters: (string|undefined)[]
  ):  Promise<T | undefined> {

    parameters.forEach(param => {
      url = url.replace('%s', param ?? '');
    });

    let config: AxiosRequestConfig;
    if (this.userAuth?.token) {
      const headers = { ...BASE_HEADERS, 'ClearBlade-UserToken': this.userAuth?.token };
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
        this.log.warning(caller, JSON.stringify(res.data));
        throw new Error(strings.http.noDataReceived);
      }

      this.log.ifVerbose(`${caller}() —`, url.substring(BASE_URL_V1.length + 1), `\n${JSON.stringify(res.data)}`);
      this.retryIndex = 0;

      return res.data;

    } catch (err: unknown) {
      return this.retryHTTPIfPossible<T>(err, caller, () => this.httpRequest<T>(caller, data, url, ...parameters));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async retryHTTPIfPossible<T = any>(err: unknown, caller: string, retry: () => (Promise<T | undefined>)): Promise<T | undefined> {

    if (!isAxiosError(err)) {
      this.log.warning((err as Error).message);
      return undefined;
    }
  
    const errorCode = err.code || err.response?.status?.toString() || 'UNKNOWN';

    if (!HTTP_RETRY_CODES.includes(errorCode) || this.retryIndex >= DELAYS.length) {
      this.log.warning(err.message);
      return undefined;
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

  private async authenticateUser(): Promise<boolean> {

    const data = { email: this.email, password: this.password };
    const tokenData = await this.httpRequest<UserTokenData>(this.authenticateUser.name, data, AUTH_URL);

    if (!tokenData) {
      return false;
    } 
    
    this.userAuth = new UserAuth(tokenData);
    this.userAuth.save(this.email);

    this.log.always(strings.http.authSuccess);

    return true;
  }

  private async authenticateDevice(serialNumber: string, deviceName: string, activeKey: string): Promise<boolean> {

    const data = { deviceName, activeKey };
    const tokenData = await this.httpRequest<DeviceTokenData>(this.authenticateDevice.name, data, AUTH_DEVICE_URL);

    if (!tokenData) {
      return false;
    }
    
    DeviceAuth.save(serialNumber, tokenData, this.email);

    return true;
  }

  private async getLocations(): Promise<void> {
      
    const data = { 'resource': 'friedrich' };

    const locationsData = await this.httpRequest<LocationsResponse>(this.getLocations.name, data, LOCATIONS_URL);
    if (!locationsData) {
      return;
    }

    for (const location of locationsData.results.locations) {
      for (const equipmentData of location.equiptments) {

        let equipment: Equipment | null = null;
        switch(equipmentData.device_type) {
        case undefined:
          break;
        case EquipmentType.THERMOSTAT:
          equipment = new Thermostat(this, equipmentData as unknown as ThermostatData);
          break;
        case EquipmentType.WATER_HEATER:
          equipment = new WaterHeater(this, equipmentData as unknown as WaterHeaterData);
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
      };
    };
  }

  private setupMQTTConnections(): void {
    
    if (!this.equipments.size) {
      return;
    }
  
    if (!this.userAuth?.token) {
      this.log.error(strings.mqtt.userAuthMissing);
      return;
    }

    this.userClient = EconetMQTT.connectUserClient(this.userAuth, this.email, this.equipments, this.log, this.debugMQTT, async () => {
      await this.authenticateUser();
    });

    for (const equipment of this.equipments.values()) {
      const device = this.devices.find( (device) => device.serialNumber === equipment.serialNumber);
      if (device === undefined) {
        continue;
      }

      const auth = DeviceAuth.load(device.serialNumber, this.email);
      if (auth === undefined) {
        this.log.error(strings.mqtt.deviceAuthMissing);
        continue;
      }

      const equipments: [string, Equipment][] = [[equipment.serialNumber, equipment]];
      const deviceClient = EconetMQTT.connectDeviceClient(auth, new Map(equipments), this.log, this.debugMQTT, async () => {
        await this.authenticateDevice(device.serialNumber, device.deviceName, device.activeKey);
      });
      this.deviceClients.push(deviceClient);
    }
  }
}
