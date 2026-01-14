import { TemperatureControlAccessory } from './temperatureControl.js';

import { AccessoryType, HKCharacteristicKey, MQTTKey, MQTTKeys } from '../../model/enums.js';
import { AccessoryDependency, WaterHeaterData } from '../../model/types.js';
import { strings } from '../../i18n/i18n.js';

export class WaterHeaterAccessory extends TemperatureControlAccessory {

  protected getAccessoryType(): AccessoryType {
    return AccessoryType.HeaterCooler;
  }

  constructor(dependency: AccessoryDependency, data: WaterHeaterData) {
    super(dependency, data);

    const active = this.getValue(data['@ENABLED']) === 1 ? this.Characteristic.Active.ACTIVE : this.Characteristic.Active.INACTIVE;

    const enabledMQTTKeys = MQTTKeys(MQTTKey.ENABLED_D, MQTTKey.ENABLED_U);
    this.setup(HKCharacteristicKey.Active, active, enabledMQTTKeys,
      this.bindOnUpdateNumericBoolean(HKCharacteristicKey.Active, strings.waterHeater.enabled, strings.waterHeater.disabled),
      this.bindOnSetNumericBoolean(HKCharacteristicKey.Active, enabledMQTTKeys, strings.waterHeater.enabledSet, strings.waterHeater.disabledSet));
  }
}