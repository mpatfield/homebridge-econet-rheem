import { CharacteristicValue, PrimitiveTypes } from 'homebridge';

import { TemperatureControlAccessory, TemperatureDefaults, Thresholds } from './temperatureControl.js';

import { OnUpdateHandler } from '../abstract/base.js';

import { strings } from '../../i18n/i18n.js';

import { AccessoryType, HKCharacteristicKey, MQTTKey, MQTTKeys, ThermostatMode } from '../../model/enums.js';
import { HistoryType } from '../../model/history.js';
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

  private readonly currentStateMap: Map<ThermostatMode, CharacteristicValue>;
  private readonly targetStateMap: Map<ThermostatMode, CharacteristicValue>;

  private deadband: number;
  private modes = new Map<number, ThermostatMode>();

  private mode: ThermostatMode;
  private running: boolean;

  private heatThresholds: Thresholds;
  private coolThresholds: Thresholds;

  constructor(dependency: AccessoryDependency, data: ThermostatData) {
    super(dependency, data, TemperatureDefaults(DEFAULT_SETPOINT, DEFAULT_LOWER_LIMIT, DEFAULT_UPPER_LIMIT));

    this.deadband = data['@DEADBAND']?.value ?? 0;

    const textModes = data['@MODE']?.constraints?.enumText ?? [];
    textModes.forEach((textMode: string, index: number) => {

      let mode: ThermostatMode;

      const cleanedString = textMode.trim().replace(' ', '_').toUpperCase();
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
      case 'FAN_ONLY':
        mode = ThermostatMode.FAN_ONLY;
        break;
      case 'EMERGENCY_HEAT':
        mode = ThermostatMode.EMERGENCY_HEAT;
        break;
      default:
        this.log.warning(`${this.name} has unknown mode '${textMode}'`);
        return;
      }

      this.modes.set(index, mode);
    });

    this.currentStateMap = new Map<ThermostatMode, CharacteristicValue>([
      [ThermostatMode.OFF, dependency.Characteristic.CurrentHeatingCoolingState.OFF],
      [ThermostatMode.HEATING, dependency.Characteristic.CurrentHeatingCoolingState.HEAT],
      [ThermostatMode.EMERGENCY_HEAT, dependency.Characteristic.CurrentHeatingCoolingState.HEAT],
      [ThermostatMode.COOLING, dependency.Characteristic.CurrentHeatingCoolingState.COOL],
      [ThermostatMode.FAN_ONLY, dependency.Characteristic.CurrentHeatingCoolingState.COOL],
    ]);

    this.targetStateMap = new Map<ThermostatMode, CharacteristicValue>([
      [ThermostatMode.OFF, dependency.Characteristic.TargetHeatingCoolingState.OFF],
      [ThermostatMode.HEATING, dependency.Characteristic.TargetHeatingCoolingState.HEAT],
      [ThermostatMode.EMERGENCY_HEAT, dependency.Characteristic.TargetHeatingCoolingState.HEAT],
      [ThermostatMode.COOLING, dependency.Characteristic.TargetHeatingCoolingState.COOL],
      [ThermostatMode.FAN_ONLY, dependency.Characteristic.TargetHeatingCoolingState.COOL],
      [ThermostatMode.AUTO, dependency.Characteristic.TargetHeatingCoolingState.AUTO],
    ]);

    this.heatThresholds = this.setupThreshold(HKCharacteristicKey.HeatingThresholdTemperature, data['@HEATSETPOINT'],
      MQTTKeys(MQTTKey.UNKNOWN, MQTTKey.HEAT_SETPOINT_U));

    this.coolThresholds = this.setupThreshold(HKCharacteristicKey.CoolingThresholdTemperature, data['@COOLSETPOINT'],
      MQTTKeys(MQTTKey.UNKNOWN, MQTTKey.COOL_SETPOINT_U));

    this.service.getCharacteristic(this.characteristicFromKey(HKCharacteristicKey.TargetTemperature))
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    this.mode = this.modes.get(data['@MODE']?.value ?? -1) ?? ThermostatMode.OFF;
    this.running = (this.getValue(data['@RUNNINGSTATUS'])?.replace(/\s/g, '') ?? '').length > 0;

    this.setup(HKCharacteristicKey.CurrentHeatingCoolingState, this.currentState, MQTTKeys(MQTTKey.UNKNOWN, MQTTKey.RUNNINGSTATUS_U),
      this.bindOnUpdateCurrentMode());

    this.setup(HKCharacteristicKey.TargetHeatingCoolingState, this.targetState, MQTTKeys(MQTTKey.UNKNOWN, MQTTKey.MODE_U),
      this.bindOnUpdateTargetMode(), this.bindOnSetTargetMode());

    const currentHumidity = data['@HUMIDITY']?.value ?? DEFAULT_HUMIDITY;
    this.setup(HKCharacteristicKey.CurrentRelativeHumidity, currentHumidity, MQTTKeys(MQTTKey.UNKNOWN, MQTTKey.HUMIDITY_U),
      this.bindOnUpdateNumeric(HKCharacteristicKey.CurrentRelativeHumidity, strings.thermostat.humidity, (value) => {
        this.recordHistory(HistoryType.WEATHER, { humidity: value } );        
      }));
    this.recordHistory(HistoryType.WEATHER, { humidity: currentHumidity } );        
  }

  private get currentState(): CharacteristicValue {

    if (!this.running) {
      return this.Characteristic.CurrentHeatingCoolingState.OFF;
    }
    
    const currentState = this.currentStateMap.get(this.mode);
    if (currentState !== undefined) {
      return currentState;
    }

    const currentTemp = this.getProperty(HKCharacteristicKey.CurrentTemperature) as number;
    if (this.mode === ThermostatMode.AUTO && currentTemp !== undefined) {
      const targetTemp = this.getTargetTemperature();
      return currentTemp < targetTemp ? this.Characteristic.CurrentHeatingCoolingState.HEAT : this.Characteristic.CurrentHeatingCoolingState.COOL;
    }

    this.log.warning(`${this.name} unabled to get current state for mode '${this.mode}'`);
    return this.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  private get targetState(): CharacteristicValue {

    const targetState = this.targetStateMap.get(this.mode);
    if (targetState !== undefined) {
      return targetState;
    }

    this.log.warning(`${this.name} unabled to get target state for mode '${this.mode}'`);
    return this.Characteristic.TargetHeatingCoolingState.OFF;
  }

  private bindOnUpdateCurrentMode(): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {

      if (typeof value !== 'number') {
        this.log.error(strings.accessory.badValue, this.name, 'number', HKCharacteristicKey.CurrentHeatingCoolingState, `${value.toString()}`);
        return;
      }

      const currentState = this.currentState;
      this.onUpdate(HKCharacteristicKey.CurrentHeatingCoolingState, currentState, this.logStringForState(currentState));

    }).bind(this);
  }

  private bindOnUpdateTargetMode(): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {

      if (typeof value !== 'number') {
        this.log.error(strings.accessory.badValue, this.name, 'number', HKCharacteristicKey.TargetHeatingCoolingState, `${value.toString()}`);
        return;
      }

      const mode = this.modes.get(value);
      if (mode === undefined) {
        this.log.warning(`${this.name} unabled to get target mode for value '${value}'`);
        return;
      }

      this.mode = mode;

      const targetState = this.targetState;
      this.onUpdate(HKCharacteristicKey.TargetHeatingCoolingState, targetState, this.logStringForState(targetState, true));

    }).bind(this);
  }

  private bindOnSetTargetMode() {
    return (async (value: CharacteristicValue) => {

      for (const [mode, state] of this.targetStateMap.entries()) {

        if (state === value) {
          for (const [publish, compare] of this.modes.entries()) {

            if (compare === mode) {
              const logString = this.logStringForState(value);
              this.onSet(HKCharacteristicKey.TargetHeatingCoolingState, MQTTKeys(MQTTKey.UNKNOWN, MQTTKey.MODE_U), value, publish, logString);
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
      this.log.warning(`${this.name} is unable to determine the target temperature`);
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
      payload[this.isDeviceAuth ? MQTTKey.UNKNOWN : MQTTKey.HEAT_SETPOINT_U] = temperature;
      break;
    case this.Characteristic.TargetHeatingCoolingState.COOL:
      payload[this.isDeviceAuth ? MQTTKey.UNKNOWN : MQTTKey.COOL_SETPOINT_U] = temperature;
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
        
      payload[this.isDeviceAuth ? MQTTKey.UNKNOWN : MQTTKey.HEAT_SETPOINT_U] = heatSetPoint;
      payload[this.isDeviceAuth ? MQTTKey.UNKNOWN : MQTTKey.COOL_SETPOINT_U] = coolSetPoint;

      break;
    }
    }

    if (Object.keys(payload).length > 0) {
      this.publishPayload(payload);
    }
  }
}