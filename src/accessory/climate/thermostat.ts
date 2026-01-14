import { TemperatureControlAccessory } from './temperatureControl.js';

import { AccessoryType } from '../../model/enums.js';
import { AccessoryDependency, ThermostatData } from '../../model/types.js';

export class ThermostatAccessory extends TemperatureControlAccessory {

  protected getAccessoryType(): AccessoryType {
    return AccessoryType.Thermostat;
  }

  constructor(dependency: AccessoryDependency, data: ThermostatData) {
    super(dependency, data);
  }
}