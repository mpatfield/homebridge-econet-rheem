import { PlatformAccessory, PlatformConfig as HBPlatformConfig } from 'homebridge';

export type ServiceType = typeof import('homebridge').Service;
export type CharacteristicType = typeof import('homebridge').Characteristic;

import { EquipmentType } from './enums.js';

import { History } from './history.js';
import { Log } from '../tools/log.js';
import { DeviceAuth, UserAuth } from './auth.js';

export type PlatformConfig = HBPlatformConfig & {
  email: string,
  password: string,
  devices?: DeviceDetails[]
  enableHistory?: boolean,
  disableLogging?: boolean,
  debug?: boolean,
}

export type DeviceDetails = {
  serialNumber: string,
  deviceName: string,
  activeKey: string
}

export type AccessoryDependency = {
  Service: ServiceType,
  Characteristic: CharacteristicType,
  platformAccessory: PlatformAccessory,
  log: Log,
  history: History,
  disableLogging: boolean,
  debug: boolean,
  email: string,
  auth: DeviceAuth | UserAuth
}

export type UserTokenData = {
  user_id: string,
  user_token: string,
  options: { account_id: string, message: string, success: boolean },
}

export type DeviceTokenData = {
  deviceName: string,
  deviceToken: string,
}

type LocationData = {
  equiptments: EquipmentData[],
}

export type LocationsResponse = {
  results: {locations: LocationData[]},
}

type NumberValue = {
  value: number,
}

type StringValue = {
  value: string;
}

export type Setpoint = {
  constraints: SetpointConstraints;
  value: number;
}

type SetpointConstraints = {
  lowerLimit?: number;
  upperLimit?: number;
  units?: string;
}

export type EquipmentData = {
  device_type: EquipmentType,
  serial_number: string,
  device_name: string,
  mac_address: string,
  '@ALERTCOUNT'?: number,
  '@NAME'?: StringValue,
  '@RUNNINGSTATUS'?: StringValue,
  '@SETPOINT'?: Setpoint,
  zoning_devices?: EquipmentData[],
}

type ModeConstraints = {
  enumText?: string[];
}

type Mode = {
  constraints?: ModeConstraints;
  value?: number;
}

export type ThermostatData = EquipmentData & {
  '@MODE'?: Mode,
  '@HUMIDITY'?: NumberValue,
  '@COOLSETPOINT'?: Setpoint,
  '@HEATSETPOINT'?: Setpoint,
  '@DEADBAND'?: NumberValue,
}

export type WaterHeaterData = EquipmentData & {
  '@RUNNING'?: string,
  '@ENABLED'?: NumberValue,
  '@HOTWATER'?: string;
}