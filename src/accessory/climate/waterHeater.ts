import { PrimitiveTypes } from 'homebridge';

import { TemperatureControlAccessory, TemperatureDefaults } from './temperatureControl.js';

import { OnUpdateHandler } from '../abstract/base.js';

import { strings } from '../../i18n/i18n.js';

import { AccessoryType, HKCharacteristicKey, MQTTKey, MQTTKeys } from '../../model/enums.js';
import { AccessoryDependency, WaterHeaterData } from '../../model/types.js';

const DEFAULT_SETPOINT = 50;
const DEFAULT_LOWER_LIMIT = 35;
const DEFAULT_UPPER_LIMIT = 65;

export class WaterHeaterAccessory extends TemperatureControlAccessory {

  protected getAccessoryType(): AccessoryType {
    return AccessoryType.HeaterCooler;
  }

  constructor(dependency: AccessoryDependency, data: WaterHeaterData) {
    super(dependency, data, TemperatureDefaults(DEFAULT_SETPOINT, DEFAULT_LOWER_LIMIT, DEFAULT_UPPER_LIMIT));

    const active = this.getValue(data['@ENABLED']) === 1 ? dependency.Characteristic.Active.ACTIVE : dependency.Characteristic.Active.INACTIVE;
    const enabledMQTTKeys = MQTTKeys(MQTTKey.ENABLED_D, MQTTKey.ENABLED_U);
    this.setup(HKCharacteristicKey.Active, active, enabledMQTTKeys,
      this.bindOnUpdateNumericBoolean(HKCharacteristicKey.Active, strings.waterHeater.enabled, strings.waterHeater.disabled),
      this.bindOnSetNumericBoolean(HKCharacteristicKey.Active, enabledMQTTKeys, strings.waterHeater.enabledSet, strings.waterHeater.disabledSet));

    this.setCharacteristicValue(HKCharacteristicKey.TargetHeaterCoolerState, dependency.Characteristic.TargetHeaterCoolerState.HEAT)
      ?.setProps({ validValues: [dependency.Characteristic.TargetHeaterCoolerState.HEAT] });

    const running = (this.getValue(data['@RUNNING'])?.replace(/\s/g, '') ?? '').length > 0;
    const initialState = running ? dependency.Characteristic.CurrentHeaterCoolerState.HEATING : dependency.Characteristic.CurrentHeaterCoolerState.IDLE;
    const runningMQTTKeys = MQTTKeys(MQTTKey.RUNNING_D, MQTTKey.RUNNING_U);
    this.setup(HKCharacteristicKey.CurrentHeaterCoolerState, initialState, runningMQTTKeys,
      this.bindOnCurrentStateUpdate(),
    )?.setProps({ validValues: [dependency.Characteristic.CurrentHeaterCoolerState.IDLE, dependency.Characteristic.CurrentHeaterCoolerState.HEATING] });

    this.setupThreshold(HKCharacteristicKey.HeatingThresholdTemperature, data['@SETPOINT'], MQTTKeys(MQTTKey.SETPOINT_D, MQTTKey.SETPOINT_U));
  }

  private bindOnCurrentStateUpdate(): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {

      let running: boolean = false;
      if (this.isDeviceAuth) {

        if (typeof value !== 'number') {
          this.log.error(strings.accessory.badValue, this.name, 'number', HKCharacteristicKey.CurrentHeaterCoolerState, `${JSON.stringify(value)}`);
          return;
        }

        running = value === 1;
      } else {

        if (typeof value !== 'string') {
          this.log.error(strings.accessory.badValue, this.name, 'string', HKCharacteristicKey.CurrentHeaterCoolerState, `${JSON.stringify(value)}`);
          return;
        }

        running = value.replace(/\s/g, '').length > 0;
      }

      const state = running ? this.Characteristic.CurrentHeaterCoolerState.HEATING : this.Characteristic.CurrentHeaterCoolerState.IDLE;
      const logString = running ? strings.waterHeater.running : strings.waterHeater.idle;

      this.onUpdate(HKCharacteristicKey.CurrentHeaterCoolerState, state, logString);

    }).bind(this);
  }
}