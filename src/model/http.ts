import axios, { AxiosRequestConfig, AxiosResponse, isAxiosError } from 'axios';

import { DeviceAuth, UserAuth } from './auth.js';

import { EquipmentType } from './enums.js';
import { DeviceDetails, DeviceTokenData, EquipmentData, LocationsResponse, UserTokenData } from './types.js';

import { strings } from '../i18n/i18n.js';

import { CLEARBLADE_HOST, CLEARBLADE_KEY, CLEARBLADE_SECRET } from '../homebridge/settings.js';

import { Log } from '../tools/log.js';
import { DELAYS, MINUTE, SECOND } from '../tools/time.js';

const BASE_HEADERS = {
  'ClearBlade-SystemKey': CLEARBLADE_KEY,
  'ClearBlade-SystemSecret': CLEARBLADE_SECRET,
  'Content-Type': 'application/json; charset=UTF-8',
};

const BASE_URL_V1 = `https://${CLEARBLADE_HOST}/api/v/1`;
const BASE_URL_V2 = `https://${CLEARBLADE_HOST}/api/v/2`;
const AUTH_USER_URL = `${BASE_URL_V1}/user/auth`;
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

export class EconetApi {
  private userAuth?: UserAuth;
  private retryIndex: number = 0;

  private static instance?: EconetApi;

  private constructor(
    public readonly log: Log,
    private readonly email: string,
    private readonly password: string,
  ) {}

  public static async connect(log: Log, email: string, password: string, devices: DeviceDetails[]): Promise<EquipmentData[] | undefined> {
    const api = new EconetApi(log, email, password);
    EconetApi.instance = api;

    api.userAuth = UserAuth.load(email);

    let shouldContinue = true;
    if (!api.userAuth) {
      shouldContinue = await api.authenticateUser();
    }

    if (!shouldContinue) {
      return;
    }

    const equipmentsData = await api.getLocations();
    if (!equipmentsData) {
      return;
    }

    for (const equipmentData of equipmentsData.values()) {
      const device = devices.find( (device) => device.serialNumber === equipmentData.serial_number);
      if (device !== undefined && DeviceAuth.load(device.serialNumber, email) === undefined) {
        await api.authenticateDevice(device.serialNumber, device.deviceName, device.activeKey);
      }
    }

    return equipmentsData;
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

      this.log.ifVerbose(`${caller}() —`, `${url.substring(BASE_URL_V1.length + 1)}${data ? ` ${JSON.stringify(data)}` : ''}`, `\n${JSON.stringify(res.data)}`);
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

  public static async authenticateUser() {
    await EconetApi.instance?.authenticateUser();
  }

  private async authenticateUser(): Promise<boolean> {

    const data = { email: this.email, password: this.password };
    const tokenData = await this.httpRequest<UserTokenData>(this.authenticateUser.name, data, AUTH_USER_URL);

    if (!tokenData) {
      return false;
    } 

    if (tokenData.options.success === false) {
      this.log.warning(tokenData.options.message);
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

  private async getLocations(): Promise<EquipmentData[] | undefined> {
      
    const data = { 'resource': 'friedrich' };

    const locationsData = await this.httpRequest<LocationsResponse>(this.getLocations.name, data, LOCATIONS_URL);
    if (!locationsData) {
      return;
    }
    
    const equipmentsData: EquipmentData[] = [];

    for (const location of locationsData.results.locations) {
      for (const equipmentData of location.equiptments) {

        if (equipmentData.device_type === undefined) {
          continue;
        }

        if (!this.validateEquipmentData(equipmentData)) {
          continue;
        }

        equipmentsData.push(equipmentData);

        if (equipmentData.device_type !== EquipmentType.THERMOSTAT || !Array.isArray(equipmentData.zoning_devices)) {
          continue;
        }

        equipmentData.zoning_devices.forEach(zoningEquipmentData => {
          if (this.validateEquipmentData(zoningEquipmentData)) {
            equipmentsData.push(zoningEquipmentData);
          }
        });
      }
    }

    return equipmentsData;
  }

  private validateEquipmentData(equipmentData: EquipmentData): boolean {

    if (!Object.values(EquipmentType).includes(equipmentData.device_type)) {  
      this.log.warning(strings.equipment.unsupported, equipmentData.device_type);
      return false;
    }

    if (equipmentData.serial_number === undefined) {
      this.log.warning(strings.equipment.missingSerial, equipmentData.device_type);
      return false;
    }

    return true;
  }
}
