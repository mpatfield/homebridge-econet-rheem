export enum AccessoryType {
  HeaterCooler = 'HeaterCooler',
  Thermostat = 'Thermostat',
}

export enum EquipmentType {
  THERMOSTAT = 'HVAC',
  WATER_HEATER = 'WH'
}

export type CharacteristicKey = HKCharacteristicKey | EveCharacteristicKey;

export enum HKCharacteristicKey {
  Active = 'Active',
  CurrentHeaterCoolerState = 'CurrentHeaterCoolerState',
  CurrentTemperature = 'CurrentTemperature',
  HeatingThresholdTemperature = 'HeatingThresholdTemperature',
  StatusFault = 'StatusFault',
  TargetHeaterCoolerState = 'TargetHeaterCoolerState',
  TemperatureDisplayUnits = 'TemperatureDisplayUnits',
}

export enum EveCharacteristicKey {
  LastActivation = 'LastActivation',
}

export enum MQTTKey {
  ALERT_COUNT_D = 'UNKNOWN', // TODO
  ALERT_COUNT_U = '@ALERTCOUNT',
  CURRENT_TEMP = 'UPHTRTMP',
  ENABLED_D = 'WHTRENAB',
  ENABLED_U = '@ENABLED',
  RUNNING_D = 'COMP_RLY',
  RUNNING_U = '@RUNNING',
  SETPOINT_D = 'WHTRSETP',
  SETPOINT_U = '@SETPOINT',
}

type MQTTKeyGroup = { device: MQTTKey, user: MQTTKey}

export type MQTTKeys = MQTTKey | MQTTKeyGroup;

export function MQTTKeys(device: MQTTKey, user: MQTTKey): MQTTKeyGroup {
  return { device, user };
}

export enum TimeUnits {
  MILLISECONDS = 'MILLISECONDS',
  SECONDS = 'SECONDS',
  MINUTES = 'MINUTES',
  HOURS = 'HOURS',
}
