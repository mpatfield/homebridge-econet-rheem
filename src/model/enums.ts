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
  Active = 'Active'
}

export enum EveCharacteristicKey {
  LastActivation = 'LastActivation',
}

export enum MQTTKey {
  ENABLED_D = 'WHTRENAB',
  ENABLED_U = '@ENABLED',
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
