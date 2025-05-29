export enum EquipmentType {
  THERMOSTAT = 'HVAC',
  WATER_HEATER = 'WH'
}

export enum ThermostatOperationMode {
  OFF = 1,
  HEATING = 2,
  COOLING = 3,
  AUTO = 4,
  FAN_ONLY = 5,
  EMERGENCY_HEAT = 6,
  UNKNOWN = 99
}

export enum TemperatureUnits {
  FAHRENHEIT = 1,
  CELSIUS = 2
}
