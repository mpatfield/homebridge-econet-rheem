import { ThermostatOperationMode } from './constants.js';

export type ValueOrObject<T> = T | { value: T };

export function getValue<T>(input: ValueOrObject<T>): T {
  return typeof input === 'object' && input !== null && 'value' in input
    ? input.value
    : (input as T);
}

export type UserTokenData = {
  user_id: string;
  user_token: string;
  options: { account_id: string};
};

export type DeviceTokenData = {
  deviceName: string;
  deviceToken: string;
}

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
  lowerLimit?: number;
  upperLimit?: number;
  units?: string;
}

export type ModeConstraints = {
  enumText?: string[];
}

export type Mode = {
  constraints?: ModeConstraints;
  value?: ThermostatOperationMode;
}

export type EquipmentData = {
  device_type?: string;
  device_name?: string;
  serial_number?: string;
  mac_address?: string,
  '@NAME'?: StringValue;
  '@ALERTCOUNT'?: number;
  '@SETPOINT'?: Setpoint;
  zoning_devices?: EquipmentData[];
}

export type LocationData = {
  equiptments: EquipmentData[];
}

export type LocationsResponse = {
  results: {locations: LocationData[]};
}

export type ThermostatData = {
  '@HUMIDITY'?: NumberValue;
  '@SETPOINT'?: NumberValue;
  '@COOLSETPOINT'?: Setpoint;
  '@HEATSETPOINT'?: Setpoint;
  '@DEADBAND'?: NumberValue;
  '@MODE'?: Mode;
  '@RUNNINGSTATUS'?: string;
}

export type WaterHeaterData = {
  '@RUNNING'?: string;
  '@ENABLED'?: NumberValue;
  '@SETPOINT'?: Setpoint;
  '@HOTWATER'?: string;
}

export type UserMQTTData = {
  serial_number?: string;
  '@ALERTCOUNT'?: number;
  '@ENABLED'?: ValueOrObject<number>;
  '@SETPOINT'?: number;
  '@HOTWATER'?: string;
  '@RUNNING'?: string;
  '@RUNNINGSTATUS'?: string;
  '@HUMIDITY'?: number;
  '@COOLSETPOINT'?: number;
  '@HEATSETPOINT'?: number;
  '@MODE'?: NumberValue;
}

export type DeviceMQTTData = {
  COMP_RLY?: number; // compressor running
  UPHTRTMP?: number; // current temperature
  WHTRENAB?: number; // enabled
  WHTRSETP?: number; // setpoint
}

export interface MQTTError extends Error {
  code?: string | number;
}