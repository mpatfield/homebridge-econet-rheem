import { BaseAccessory } from '../abstract/base.js';

import { AccessoryDependency, EquipmentData } from '../../model/types.js';

export abstract class TemperatureControlAccessory extends BaseAccessory {

  constructor(dependency: AccessoryDependency, data: EquipmentData) {
    super(dependency, data);
  }
}