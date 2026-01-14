import { BaseAccessory } from '../abstract/base.js';

import { AccessoryDependency, EquipmentData } from '../../model/types.js';

import { TemperatureUnits } from '../../tools/temperature.js';
import { HKCharacteristicKey } from '../../model/enums.js';

export abstract class TemperatureControlAccessory extends BaseAccessory {

  private readonly units: TemperatureUnits; 

  constructor(dependency: AccessoryDependency, data: EquipmentData) {
    super(dependency, data);

    this.units = data['@SETPOINT']?.constraints?.units?.includes('F') ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS;

    const temperatureDisplayUnits = this.units === TemperatureUnits.FAHRENHEIT ?
      dependency.Characteristic.TemperatureDisplayUnits.FAHRENHEIT : dependency.Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.setCharacteristicValue(HKCharacteristicKey.TemperatureDisplayUnits, temperatureDisplayUnits);

    
  }
}