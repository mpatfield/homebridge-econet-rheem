import { EconetApi } from './api.js';
import { EquipmentType, ThermostatOperationMode } from './constants.js';
import { Equipment } from './equipment.js';
import { EquipmentData, getValue, MQTTData, ThermostatData } from './types.js';

import { strings } from '../i18n/i18n.js';

import { fromCelsius } from '../tools/temperature.js';

const DEFAULT_HUMIDITY = 50;
const DEFAULT_LOWER_LIMIT = 10;
const DEFAULT_UPPER_LIMIT = 30;
const DEFAULT_SETPOINT = 20;

export class Thermostat extends Equipment {

  private current_humidity = 0;
  private current_temp = 0;

  private cool_set_point = 0;
  private cool_lower_limit = 0;
  private cool_upper_limit = 0;

  private heat_set_point = 0;
  private heat_lower_limit = 0;
  private heat_upper_limit = 0;

  private dead_band = 0;

  private modes: Map<number, ThermostatOperationMode> = new Map();
  private current_mode = ThermostatOperationMode.UNKNOWN;

  constructor(api: EconetApi, data: ThermostatData) {
    super(api, data as unknown as EquipmentData);

    const defaultLowerLimit = fromCelsius(DEFAULT_LOWER_LIMIT, this.units);
    const defaultUpperLimit = fromCelsius(DEFAULT_UPPER_LIMIT, this.units);
    const defaultSetpoint = fromCelsius(DEFAULT_SETPOINT, this.units);

    this.running = data['@RUNNINGSTATUS'] ? data['@RUNNINGSTATUS']?.replace(/\s/g, '').length > 0 : false;

    this.current_humidity = data['@HUMIDITY']?.value ?? DEFAULT_HUMIDITY;
    this.current_temp = data['@SETPOINT']?.value ?? defaultSetpoint;

    this.cool_lower_limit = data['@COOLSETPOINT']?.constraints.lowerLimit ?? defaultLowerLimit;
    this.cool_upper_limit = data['@COOLSETPOINT']?.constraints.upperLimit ?? defaultUpperLimit;
    this.cool_set_point = data['@COOLSETPOINT']?.value ?? defaultSetpoint;

    this.heat_lower_limit = data['@HEATSETPOINT']?.constraints.lowerLimit ?? defaultLowerLimit;
    this.heat_upper_limit = data['@HEATSETPOINT']?.constraints.upperLimit ?? defaultUpperLimit;
    this.heat_set_point = data['@HEATSETPOINT']?.value ?? defaultSetpoint;

    this.dead_band = data['@DEADBAND']?.value ?? 0;

    const text_modes = data['@MODE']?.constraints?.enumText ?? [];

    this.modes.clear();
    if (text_modes) {
      text_modes.forEach((textMode: string, index: number) => {
        const mode = this._modeFromString(textMode);
        if (mode !== ThermostatOperationMode.UNKNOWN) {
          this.modes.set(index, mode);
        }
      });
    }

    this.current_mode = this.modes.get(data['@MODE']?.value ?? -1) ?? ThermostatOperationMode.UNKNOWN;

    this.didUpdate();
  }

  get type(): EquipmentType {
    return EquipmentType.THERMOSTAT;
  }

  get humidity(): number {
    return this.current_humidity;
  }

  get currentTemp(): number {
    return this.current_temp;
  }

  get coolSetPoint(): number {
    return this.cool_set_point;
  }

  get coolSetPointLimits(): [number, number] {
    return [this.cool_lower_limit, this.cool_upper_limit];
  }

  get heatSetPoint(): number {
    return this.heat_set_point;
  }

  get heatSetPointLimits(): [number, number] {
    return [this.heat_lower_limit, this.heat_upper_limit];
  }

  get deadband(): number {
    return this.dead_band;
  }

  get mode(): ThermostatOperationMode {
    return this.current_mode;
  }

  updateFromMQTT(data: MQTTData): void {
    super.updateFromMQTT(data);

    if (data['@HUMIDITY'] !== undefined) {
      this.current_humidity = data['@HUMIDITY'];
      this.log.ifVerbose(strings.debug.humidityState, this.deviceName, this.current_humidity);
    }

    if (data['@SETPOINT'] !== undefined) {
      this.current_temp = data['@SETPOINT'];
      this.log.ifVerbose(strings.debug.currentTempState, this.deviceName, this.current_temp);
    }

    if (data['@COOLSETPOINT'] !== undefined) {
      this.cool_set_point = data['@COOLSETPOINT'];
      this.log.ifVerbose(strings.debug.coolSetpoint, this.deviceName, this.cool_set_point);
    }

    if (data['@HEATSETPOINT'] !== undefined) {
      this.heat_set_point = data['@HEATSETPOINT'];
      this.log.ifVerbose(strings.debug.heatSetpoint, this.deviceName, this.heat_set_point);
    }

    if (data['@MODE'] !== undefined) {
      const modeIndex = getValue(data['@MODE']);
      this.current_mode = this.modes.get(modeIndex) ?? ThermostatOperationMode.UNKNOWN;
      this.log.ifVerbose(strings.debug.modeState, this.deviceName, this._stringFromMode(this.current_mode) ?? 'UNKNOWN');
    }

    if (data['@RUNNINGSTATUS'] !== undefined) {
      this.running = data['@RUNNINGSTATUS'].replace(/\s/g, '').length > 0;
      this.log.ifVerbose(strings.debug.runningState, this.deviceName, this.running);
    }

    this.didUpdate();
  }

  private _modeFromString(strValue: string): ThermostatOperationMode {
    const cleanedString = strValue.trim().replace(' ', '').toUpperCase();
    switch (cleanedString) {
    case 'OFF':
      return ThermostatOperationMode.OFF;
    case 'HEATING':
      return ThermostatOperationMode.HEATING;
    case 'COOLING':
      return ThermostatOperationMode.COOLING;
    case 'AUTO':
      return ThermostatOperationMode.AUTO;
    case 'FANONLY':
      return ThermostatOperationMode.FAN_ONLY;
    case 'EMERGENCYHEAT':
      return ThermostatOperationMode.EMERGENCY_HEAT;
    default:
      this.log.error(strings.equipment.unknownMode, strValue);
      return ThermostatOperationMode.UNKNOWN;
    }
  }

  private _stringFromMode(mode: ThermostatOperationMode): string | null {
    switch(mode) {
    case ThermostatOperationMode.OFF:
      return 'OFF';
    case ThermostatOperationMode.HEATING:
      return 'HEATING';
    case ThermostatOperationMode.COOLING:
      return 'COOLING';
    case ThermostatOperationMode.AUTO:
      return 'AUTO';
    case ThermostatOperationMode.FAN_ONLY:
      return 'FANONLY';
    case ThermostatOperationMode.EMERGENCY_HEAT:
      return 'EMERGENCYHEAT';
    default:
      return null;
    }
  }

  setMode(mode: ThermostatOperationMode): void {
    const payload: { [key: string]: number } = {};

    for (const [index, entry] of this.modes.entries()) {
      if (mode === entry) {
        payload['@MODE'] = index;
      }
    }

    if (Object.keys(payload).length > 0) {
      this.publish(payload, this.deviceId, this.serialNumber);
    } else {
      this.log.error(strings.equipment.unknownMode, mode);
    }
  }

  setSetPoint(targetTemp?: number, targetTempCool?: number, targetTempHeat?: number): void {
    const coolPayload: { [key: string]: number } = {};
    const heatPayload: { [key: string]: number } = {};

    if (targetTempCool || (targetTemp && this.mode === ThermostatOperationMode.COOLING)) {
      const temp = targetTempCool ?? targetTemp!;
      const [lower, upper] = this.coolSetPointLimits;
      if (lower <= temp && temp <= upper) {
        coolPayload['@COOLSETPOINT'] = temp;
      } else {
        this.log.error(strings.equipment.outOfRangeCool, lower, upper, temp);
      }
    }

    if (targetTempHeat || (targetTemp && [ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode))) {
      const temp = targetTempHeat ?? targetTemp!;
      const [lower, upper] = this.heatSetPointLimits;
      if (lower <= temp && temp <= upper) {
        heatPayload['@HEATSETPOINT'] = temp;
      } else {
        this.log.error(strings.equipment.outOfRangeHeat, lower, upper, temp);
      }
    }

    let hasSetTemp = false;
    if (coolPayload && [ThermostatOperationMode.AUTO, ThermostatOperationMode.COOLING].includes(this.mode)) {
      this.publish(coolPayload, this.deviceId, this.serialNumber);
      hasSetTemp = true;
    }
    if (heatPayload && [ThermostatOperationMode.AUTO, ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode)) {
      this.publish(heatPayload, this.deviceId, this.serialNumber);
      hasSetTemp = true;
    }
    if (targetTemp && !hasSetTemp) {
      let payload = {};
      if (this.mode === ThermostatOperationMode.COOLING) {
        payload = coolPayload;
      } else if ([ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode)) {
        payload = heatPayload;
      } else {
        this.log.error(strings.equipment.setpointUnknown, this.mode);
      }
      if (Object.keys(payload).length > 0) {
        this.publish(payload, this.deviceId, this.serialNumber);
      }
    }
  }
}
