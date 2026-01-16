import { CharacteristicValue, PrimitiveTypes } from 'homebridge';

import { TemperatureControlAccessory, TemperatureDefaults, Thresholds } from './temperatureControl.js';

import { OnUpdateHandler } from '../abstract/base.js';

import { strings } from '../../i18n/i18n.js';

import { AccessoryType, HKCharacteristicKey, MQTTKey, MQTTKeys, ThermostatMode } from '../../model/enums.js';
import { AccessoryDependency, ThermostatData } from '../../model/types.js';
import { fromCelsius } from '../../tools/temperature.js';

const DEFAULT_SETPOINT = 20;
const DEFAULT_LOWER_LIMIT = 10;
const DEFAULT_UPPER_LIMIT = 30;

const DEFAULT_HUMIDITY = 50;

export class ThermostatAccessory extends TemperatureControlAccessory {

  protected getAccessoryType(): AccessoryType {
    return AccessoryType.Thermostat;
  }

  private deadband: number;
  private modes = new Map<number, ThermostatMode>();

  private heatThresholds: Thresholds;
  private coolThresholds: Thresholds;

  constructor(dependency: AccessoryDependency, data: ThermostatData) {
    super(dependency, data, TemperatureDefaults(DEFAULT_SETPOINT, DEFAULT_LOWER_LIMIT, DEFAULT_UPPER_LIMIT));

    this.deadband = data['@DEADBAND']?.value ?? 0;

    const textModes = data['@MODE']?.constraints?.enumText ?? [];
    textModes.forEach((textMode: string, index: number) => {

      let mode: ThermostatMode;

      const cleanedString = textMode.trim().replace(' ', '').toUpperCase();
      switch (cleanedString) {
      case 'OFF':
        mode = ThermostatMode.OFF;
        break;
      case 'HEATING':
        mode = ThermostatMode.HEATING;
        break;
      case 'COOLING':
        mode = ThermostatMode.COOLING;
        break;
      case 'AUTO':
        mode = ThermostatMode.AUTO;
        break;
      case 'FANONLY':
        mode = ThermostatMode.FAN_ONLY;
        break;
      case 'EMERGENCYHEAT':
        mode = ThermostatMode.EMERGENCY_HEAT;
        break;
      default:
        this.log.warning(strings.thermostat.unknownMode, this.name, textMode);
        return;
      }

      this.modes.set(index, mode);
    });

    const currentStateMap = new Map<ThermostatMode | undefined, CharacteristicValue>([
      [ThermostatMode.OFF, dependency.Characteristic.CurrentHeatingCoolingState.OFF],
      [ThermostatMode.HEATING, dependency.Characteristic.CurrentHeatingCoolingState.HEAT],
      [ThermostatMode.EMERGENCY_HEAT, dependency.Characteristic.CurrentHeatingCoolingState.HEAT],
      [ThermostatMode.COOLING, dependency.Characteristic.CurrentHeatingCoolingState.COOL],
      [ThermostatMode.FAN_ONLY, dependency.Characteristic.CurrentHeatingCoolingState.COOL],
    ]);

    const currentMode = this.modes.get(data['@MODE']?.value ?? -1);
    const currentState = currentStateMap.get(currentMode) ?? dependency.Characteristic.CurrentHeatingCoolingState.OFF;

    this.setup(HKCharacteristicKey.CurrentHeatingCoolingState, currentState, MQTTKeys(MQTTKey.MODE_D, MQTTKey.MODE_U),
      this.bindOnUpdateMode(HKCharacteristicKey.CurrentHeatingCoolingState, currentStateMap, false));

    const targetStateMap = new Map<ThermostatMode | undefined, CharacteristicValue>([
      [ThermostatMode.OFF, dependency.Characteristic.TargetHeatingCoolingState.OFF],
      [ThermostatMode.HEATING, dependency.Characteristic.TargetHeatingCoolingState.HEAT],
      [ThermostatMode.EMERGENCY_HEAT, dependency.Characteristic.TargetHeatingCoolingState.HEAT],
      [ThermostatMode.COOLING, dependency.Characteristic.TargetHeatingCoolingState.COOL],
      [ThermostatMode.FAN_ONLY, dependency.Characteristic.TargetHeatingCoolingState.COOL],
      [ThermostatMode.AUTO, dependency.Characteristic.TargetHeatingCoolingState.AUTO],
    ]);

    this.setup(HKCharacteristicKey.TargetHeatingCoolingState, currentState, MQTTKeys(MQTTKey.MODE_D, MQTTKey.MODE_U),
      this.bindOnUpdateMode(HKCharacteristicKey.TargetHeatingCoolingState, targetStateMap, true),
      this.bindOnSetTargetMode(targetStateMap),
    );

    this.heatThresholds = this.setupThreshold(HKCharacteristicKey.HeatingThresholdTemperature, data['@HEATSETPOINT'],
      MQTTKeys(MQTTKey.HEAT_SETPOINT_D, MQTTKey.HEAT_SETPOINT_U));

    this.coolThresholds = this.setupThreshold(HKCharacteristicKey.CoolingThresholdTemperature, data['@COOLSETPOINT'],
      MQTTKeys(MQTTKey.COOL_SETPOINT_D, MQTTKey.COOL_SETPOINT_U));

    this.service.getCharacteristic(this.characteristicFromKey(HKCharacteristicKey.TargetTemperature))
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    const currentHumidity = data['@HUMIDITY']?.value ?? DEFAULT_HUMIDITY;
    this.setup(HKCharacteristicKey.CurrentRelativeHumidity, currentHumidity, MQTTKeys(MQTTKey.HUMIDITY_D, MQTTKey.HUMIDITY_U),
      this.bindOnUpdateNumeric(HKCharacteristicKey.CurrentRelativeHumidity, strings.thermostat.humidity));
  }

  private bindOnUpdateMode(charKey: HKCharacteristicKey, stateMap: Map<ThermostatMode | undefined, CharacteristicValue>, future: boolean): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {

      if (typeof value !== 'number') {
        this.log.error(strings.accessory.badValue, this.name, 'number', charKey, `${value.toString()}`);
        return;
      }

      const mode = this.modes.get(value);

      const state = stateMap.get(mode);
      if (state === undefined) {
        this.log.warning(strings.thermostat.unexpectedMode, this.name, `'${mode}`, charKey);
        return;
      }

      this.onUpdate(charKey, state, this.logStringForState(state, future));

    }).bind(this);
  }

  private bindOnSetTargetMode(stateMap: Map<ThermostatMode | undefined, CharacteristicValue>) {
    return (async (value: CharacteristicValue) => {

      for (const [mode, state] of stateMap.entries()) {

        if (state === value) {
          for (const [publish, compare] of this.modes.entries()) {

            if (compare === mode) {
              const logString = this.logStringForState(value);
              this.onSet(HKCharacteristicKey.TargetHeatingCoolingState, MQTTKeys(MQTTKey.MODE_D, MQTTKey.MODE_U), value, publish, logString);
              return;
            }
          }
        }
      }

      this.log.warning(strings.thermostat.targetSetFailed, this.name, `'${value}'`);

    }).bind(this);
  }

  private logStringForState(state: CharacteristicValue, future: boolean = false): string | undefined {
    switch (state) {
    case this.Characteristic.CurrentHeatingCoolingState.OFF:
    case this.Characteristic.TargetHeatingCoolingState.OFF:
      return future ? strings.thermostat.stateOffFuture : strings.thermostat.stateOff;
    case this.Characteristic.CurrentHeatingCoolingState.HEAT:
    case this.Characteristic.TargetHeatingCoolingState.HEAT:
      return future ? strings.thermostat.stateHeatFuture : strings.thermostat.stateHeat;
    case this.Characteristic.CurrentHeatingCoolingState.COOL:
    case this.Characteristic.TargetHeatingCoolingState.COOL:
      return future ? strings.thermostat.stateCoolFuture : strings.thermostat.stateCool;
    case this.Characteristic.TargetHeatingCoolingState.AUTO:
      return strings.thermostat.stateAutoFuture;
    }
  }

  private getTargetTemperature(): number {

    const heatingThreshold = this.getProperty(HKCharacteristicKey.HeatingThresholdTemperature) as number;
    const coolingThreshold = this.getProperty(HKCharacteristicKey.CoolingThresholdTemperature) as number;

    let targetTemp: number | undefined;

    const targetState = this.getProperty(HKCharacteristicKey.TargetHeatingCoolingState);
    switch(targetState) {
    case undefined:
    case this.Characteristic.TargetHeatingCoolingState.OFF:
      break;
    case this.Characteristic.TargetHeatingCoolingState.HEAT:
      targetTemp = heatingThreshold;
      break;
    case this.Characteristic.TargetHeatingCoolingState.COOL:
      targetTemp = coolingThreshold;
      break;
    case this.Characteristic.TargetHeatingCoolingState.AUTO:
      targetTemp = (heatingThreshold !== undefined && coolingThreshold !== undefined) ? (heatingThreshold + coolingThreshold) / 2 : undefined;
      break;
    }

    if (targetTemp === undefined) {
      this.log.warning(strings.thermostat.unknownTargetTemp, this.name);
    }

    return targetTemp ?? DEFAULT_SETPOINT;
  }

  private async setTargetTemperature(value: CharacteristicValue): Promise<void> {

    const temperature = fromCelsius(value as number, this.units);

    const payload: Record<string, PrimitiveTypes> = {};

    const targetState = this.getProperty(HKCharacteristicKey.TargetHeatingCoolingState);
    switch(targetState) {
    case undefined:
    case this.Characteristic.TargetHeatingCoolingState.OFF:
      break;
    case this.Characteristic.TargetHeatingCoolingState.HEAT:
      payload[this.isDeviceAuth ? MQTTKey.HEAT_SETPOINT_D : MQTTKey.HEAT_SETPOINT_U] = temperature;
      break;
    case this.Characteristic.TargetHeatingCoolingState.COOL:
      payload[this.isDeviceAuth ? MQTTKey.COOL_SETPOINT_D : MQTTKey.COOL_SETPOINT_U] = temperature;
      break;
    case this.Characteristic.TargetHeatingCoolingState.AUTO: {

      let heatSetPoint = temperature - this.deadband / 2;
      let coolSetPoint = temperature + this.deadband / 2;
        
      heatSetPoint = Math.max(this.heatThresholds.minimum, Math.min(heatSetPoint, this.heatThresholds.maximum));
      coolSetPoint = Math.max(this.coolThresholds.minimum, Math.min(coolSetPoint, this.coolThresholds.maximum));
        
      if (coolSetPoint < heatSetPoint + this.deadband) {
        if (heatSetPoint + this.deadband <= this.coolThresholds.maximum) {
          coolSetPoint = heatSetPoint + this.deadband;
        } else {
          heatSetPoint = coolSetPoint - this.deadband;
          heatSetPoint = Math.max(this.heatThresholds.minimum, heatSetPoint);
          coolSetPoint = Math.max(this.coolThresholds.minimum, heatSetPoint + this.deadband);
        }
      }
        
      payload[this.isDeviceAuth ? MQTTKey.HEAT_SETPOINT_D : MQTTKey.HEAT_SETPOINT_U] = heatSetPoint;
      payload[this.isDeviceAuth ? MQTTKey.COOL_SETPOINT_D : MQTTKey.COOL_SETPOINT_U] = coolSetPoint;

      break;
    }
    }

    if (Object.keys(payload).length > 0) {
      this.publishPayload(payload);
    }
  }
}