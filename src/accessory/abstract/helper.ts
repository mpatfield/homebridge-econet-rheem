import { BaseAccessory } from './base.js';

import { EquipmentType } from '../../model/enums.js';
import { AccessoryDependency, EquipmentData, ThermostatData, WaterHeaterData } from '../../model/types.js';

import { ThermostatAccessory } from '../climate/thermostat.js';
import { WaterHeaterAccessory } from '../climate/waterHeater.js';

export function createAccessory(dependency: AccessoryDependency, data: EquipmentData): BaseAccessory | undefined {

  switch(data.device_type) {
  case EquipmentType.THERMOSTAT:
    return new ThermostatAccessory(dependency, data as ThermostatData);
  case EquipmentType.WATER_HEATER:
    return new WaterHeaterAccessory(dependency, data as WaterHeaterData);
  }
}