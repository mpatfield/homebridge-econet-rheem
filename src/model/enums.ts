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
  CoolingThresholdTemperature = 'CoolingThresholdTemperature',
  CurrentHeaterCoolerState = 'CurrentHeaterCoolerState',
  CurrentHeatingCoolingState = 'CurrentHeatingCoolingState',
  CurrentRelativeHumidity = 'CurrentRelativeHumidity',
  CurrentTemperature = 'CurrentTemperature',
  HeatingThresholdTemperature = 'HeatingThresholdTemperature',
  StatusFault = 'StatusFault',
  TargetHeaterCoolerState = 'TargetHeaterCoolerState',
  TargetHeatingCoolingState = 'TargetHeatingCoolingState',
  TargetTemperature = 'TargetTemperature',
  TemperatureDisplayUnits = 'TemperatureDisplayUnits',
}

export enum EveCharacteristicKey {
  LastActivation = 'LastActivation',
}

export enum MQTTKey {
  ALERT_COUNT_D = 'ALERT_COUNT_D_UNKNOWN',
  ALERT_COUNT_U = '@ALERTCOUNT',
  COOL_SETPOINT_D = 'COOL_SETPOINT_D_UNKNOWN',
  COOL_SETPOINT_U = '@COOLSETPOINT',
  CURRENT_TEMP = 'UPHTRTMP',
  ENABLED_D = 'WHTRENAB',
  ENABLED_U = '@ENABLED',
  HEAT_SETPOINT_D = 'HEAT_SETPOINT_D_UNKNOWN',
  HEAT_SETPOINT_U = '@HEATSETPOINT',
  HUMIDITY_D = 'HUMIDITY_D_UNKNOWN',
  HUMIDITY_U = '@HUMIDITY',
  MODE_D = 'MODE_D_UNKNOWN',
  MODE_U = '@MODE',
  RUNNING_D = 'COMP_RLY',
  RUNNING_U = '@RUNNING',
  SETPOINT_D = 'WHTRSETP',
  SETPOINT_U = '@SETPOINT',
}

export type MQTTKeys = { device: MQTTKey, user: MQTTKey};

export function MQTTKeys(device: MQTTKey, user: MQTTKey): MQTTKeys {
  return { device, user };
}

export enum ThermostatMode {
  OFF = 1,
  HEATING = 2,
  COOLING = 3,
  AUTO = 4,
  FAN_ONLY = 5,
  EMERGENCY_HEAT = 6,
}

export enum TimeUnits {
  MILLISECONDS = 'MILLISECONDS',
  SECONDS = 'SECONDS',
  MINUTES = 'MINUTES',
  HOURS = 'HOURS',
}
