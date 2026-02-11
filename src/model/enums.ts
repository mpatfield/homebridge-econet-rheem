export enum AccessoryType {
  HeaterCooler = 'HeaterCooler',
  Thermostat = 'Thermostat',
}

export enum EquipmentType {
  THERMOSTAT = 'HVAC',
  WATER_HEATER = 'WH'
}

export type CharacteristicKey = CustomCharacteristicKey | HKCharacteristicKey | EveCharacteristicKey;

export enum CustomCharacteristicKey {
  AmbientTemperature = 'AmbientTemperature',
  HotWaterAvailable = 'HotWaterAvailable',
  RecoveryRate = 'RecoveryRate',
}

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
  CurrentConsumption = 'CurrentConsumption',
  LastActivation = 'LastActivation',
  TotalConsumption = 'TotalConsumption',
}

export enum MQTTKey {
  ALERT_COUNT_D = 'ALRMALRT',
  ALERT_COUNT_U = '@ALERTCOUNT',
  AMBIENT_TEMP_D = 'AMBIENTT',
  COOL_SETPOINT_U = '@COOLSETPOINT',
  CURRENT_TEMP_D = 'UPHTRTMP',
  CURRENT_CONSUMPTION_D = 'POWRWATT',
  ENABLED_D = 'WHTRENAB',
  ENABLED_U = '@ENABLED',
  HEAT_SETPOINT_U = '@HEATSETPOINT',
  HUMIDITY_U = '@HUMIDITY',
  HOT_WATER_AVAILABLE_D = 'HOTWATER',
  HOT_WATER_AVAILABLE_U = '@HOTWATER',
  MODE_U = '@MODE',
  RUNNING_D = 'COMP_RLY',
  RUNNING_U = '@RUNNING',
  RUNNINGSTATUS_U = '@RUNNING_STATUS',
  SETPOINT_D = 'WHTRSETP',
  SETPOINT_U = '@SETPOINT',
  TOTAL_CONSUMPTION_D = 'TOTALKWH',
  UNDEFINED = 'MQTT_KEY_UNDEFINED',
  UNKNOWN = 'MQTT_KEY_UNKNOWN'
}

export type MQTTKeys = { device: MQTTKey, user: MQTTKey};

export function MQTTKeys(device: MQTTKey, user: MQTTKey): MQTTKeys {
  return { device, user };
}

export enum ThermostatMode {
  OFF = 'OFF',
  HEATING = 'HEATING',
  COOLING = 'COOLING',
  AUTO = 'AUTO',
  FAN_ONLY = 'FAN_ONLY',
  EMERGENCY_HEAT = 'EMERGENCY_HEAT',
}

export enum TimeUnits {
  MILLISECONDS = 'MILLISECONDS',
  SECONDS = 'SECONDS',
  MINUTES = 'MINUTES',
  HOURS = 'HOURS',
}
