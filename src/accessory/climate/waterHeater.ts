import { PrimitiveTypes } from 'homebridge';

import { TemperatureControlAccessory, TemperatureDefaults } from './temperatureControl.js';

import { OnUpdateHandler } from '../abstract/base.js';

import { strings } from '../../i18n/i18n.js';

import { AccessoryType, CustomCharacteristicKey, EveCharacteristicKey, HKCharacteristicKey, MQTTKey, MQTTKeys } from '../../model/enums.js';
import { HistoryType } from '../../model/history.js';
import { AccessoryDependency, WaterHeaterData } from '../../model/types.js';

import { HOUR } from '../../tools/time.js';

const DEFAULT_SETPOINT = 50;
const DEFAULT_LOWER_LIMIT = 35;
const DEFAULT_UPPER_LIMIT = 65;

type TemperatureEntry = { temperature: number, timestamp: number }

export class WaterHeaterAccessory extends TemperatureControlAccessory {

  protected getAccessoryType(): AccessoryType {
    return AccessoryType.HeaterCooler;
  }

  private lastTemperatureEntry?: TemperatureEntry;

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
    this.recordHistory(HistoryType.CUSTOM, { status: running ? 1 : 0 }, true);

    this.setupThreshold(HKCharacteristicKey.HeatingThresholdTemperature, data['@SETPOINT'], MQTTKeys(MQTTKey.SETPOINT_D, MQTTKey.SETPOINT_U));

    const startingCurrentConsumption = this.getProperty(EveCharacteristicKey.CurrentConsumption) ?? 0;
    this.setup(EveCharacteristicKey.CurrentConsumption, startingCurrentConsumption, MQTTKeys(MQTTKey.CURRENT_CONSUMPTION_D, MQTTKey.UNDEFINED),
      this.bindOnUpdateNumeric(EveCharacteristicKey.CurrentConsumption, strings.waterHeater.currentConsumption, (value) => {
        this.recordHistory(HistoryType.CUSTOM, { power: value });
      }));

    const startingTotalConsumption = this.getProperty(EveCharacteristicKey.TotalConsumption) ?? 0;
    this.setup(EveCharacteristicKey.TotalConsumption, startingTotalConsumption, MQTTKeys(MQTTKey.TOTAL_CONSUMPTION_D, MQTTKey.UNDEFINED),
      this.bindOnUpdateNumeric(EveCharacteristicKey.TotalConsumption, strings.waterHeater.totalConsumption));

    const hotWaterAvailable = this.getHotWaterAvailable(data['@HOTWATER']);
    this.setup(CustomCharacteristicKey.HotWaterAvailable, hotWaterAvailable, MQTTKeys(MQTTKey.HOT_WATER_AVAILABLE_D, MQTTKey.HOT_WATER_AVAILABLE_U),
      async (value) => {
        const hotWaterAvailable = this.getHotWaterAvailable(value);
        this.onUpdate(CustomCharacteristicKey.AmbientTemperature, hotWaterAvailable);
      },
    );

    this.setup(CustomCharacteristicKey.RecoveryRate, 0, MQTTKeys(MQTTKey.CURRENT_TEMP_D, MQTTKey.UNDEFINED), async (value) => {
      this.onUpdate(CustomCharacteristicKey.RecoveryRate, this.getRecoveryRate(value as number));
    });

    const startingAmbientTemperature = this.getProperty(CustomCharacteristicKey.AmbientTemperature) ?? 0;
    this.setup(CustomCharacteristicKey.AmbientTemperature, startingAmbientTemperature, MQTTKeys(MQTTKey.AMBIENT_TEMP_D, MQTTKey.UNDEFINED), async (value) => {
      this.onUpdate(CustomCharacteristicKey.AmbientTemperature, value);
    });
  }

  private getRecoveryRate(temperature: number): number {

    let recoveryRate = 0;

    const currentEntry: TemperatureEntry = { temperature: temperature, timestamp: Date.now() };
    if (this.lastTemperatureEntry !== undefined && currentEntry.temperature > this.lastTemperatureEntry.temperature) {

      const deltaTemp = currentEntry.temperature - this.lastTemperatureEntry.temperature;
      const deltaTime = currentEntry.timestamp - this.lastTemperatureEntry.timestamp;

      recoveryRate = (deltaTemp / deltaTime) * HOUR;
    }

    this.lastTemperatureEntry = currentEntry;

    return recoveryRate;
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

      this.recordHistory(HistoryType.CUSTOM, { status: running ? 1 : 0 }, true);

    }).bind(this);
  }

  private getHotWaterAvailable(value: unknown): number {

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string') {
      return 100;
    }

    if (value.includes('empty') || value.includes('zero')) {
      return 0;
    }
    
    if (value.includes('ten')) {
      return 10;
    }
    
    if (value.includes('fourty')) {
      return 40;
    }
    
    if (value.includes('hundred') || value.includes('hundread')) {
      return 100;
    }

    return 100;
  }
}