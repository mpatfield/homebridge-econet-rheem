import { ThermostatOperationMode } from './constants';

export const SENSITIVE_KEYS = [
  'user_id', 'user_token', 'account_id', 'address', 'email', 'first_name',
  'last_name', 'phone_number', 'postal_code', 'macAddress', 'serialNumber',
  'street', 'city', 'zipcode', 'name', 'coordinates', 'loc', 'device_name',
  'serial_number', 'mac_address',
];

export type ValueOrObject<T> = T | { value: T };

export function getValue<T>(input: ValueOrObject<T>): T {
  return typeof input === 'object' && input !== null && 'value' in input
    ? input.value
    : (input as T);
}

export type TokenData = {
  user_id: string;
  user_token: string;
  options: { account_id: string};
};

export type StringValue = {
  value: string;
}

export type NumberValue = {
  value: number;
}

export type Setpoint = {
  constraints: SetpointConstraints;
  value: number;
}

export type SetpointConstraints = {
  lowerLimit: number;
  upperLimit: number;
  units: string;
}

export type ModeConstraints = {
  enumText: string[];
}

export type Mode = {
  constraints: ModeConstraints;
  value: ThermostatOperationMode;
}

export type EquipmentData = {
  device_type: string;
  device_name: string;
  serial_number: string;
  '@NAME': StringValue;
  '@ALERTCOUNT': number;
  '@SETPOINT': Setpoint;
}

export type LocationData = {
  equiptments: EquipmentData[];
}

export type LocationsResponse = {
  results: {locations: LocationData[]};
}

export type ThermostatData = {
  '@HUMIDITY': NumberValue;
  '@SETPOINT': NumberValue;
  '@COOLSETPOINT': Setpoint;
  '@HEATSETPOINT': Setpoint;
  '@DEADBAND': NumberValue;
  '@MODE': Mode;
  '@RUNNINGSTATUS': string;
}

export type WaterHeaterData = {
  '@RUNNING': string;
  '@ENABLED': NumberValue;
  '@SETPOINT': Setpoint;
  '@HOTWATER': string;
}

export type MQTTData = {
  serial_number: string;
  '@ALERTCOUNT'?: number;
  '@ENABLED'?: ValueOrObject<number>;
  '@SETPOINT': number;
  '@HOTWATER': string;
  '@RUNNING': string;
  '@RUNNINGSTATUS': string;
  '@HUMIDITY': number;
  '@COOLSETPOINT': number;
  '@HEATSETPOINT': number;
  '@MODE': NumberValue;
}

export interface MQTTError extends Error {
  code?: string | number;
}