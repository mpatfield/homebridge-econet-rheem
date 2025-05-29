import { EconetApi } from './api.js';
import { EquipmentType, ThermostatOperationMode } from './constants.js';
import { Equipment } from './equipment.js';

import strings from '../lang/en.js';
import { EquipmentData, getValue, MQTTData, ThermostatData } from './types.js';

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

    this.running = data['@RUNNINGSTATUS'].replace(/\s/g, '').length > 0;

    this.current_humidity = data['@HUMIDITY'].value;
    this.current_temp = data['@SETPOINT'].value || 70;

    this.cool_lower_limit = data['@COOLSETPOINT'].constraints.lowerLimit;
    this.cool_upper_limit = data['@COOLSETPOINT'].constraints.upperLimit;
    this.cool_set_point = data['@COOLSETPOINT'].value;

    this.heat_lower_limit = data['@HEATSETPOINT'].constraints.lowerLimit || 50;
    this.heat_upper_limit = data['@HEATSETPOINT'].constraints.upperLimit || 90;
    this.heat_set_point = data['@HEATSETPOINT'].value || 70;

    this.dead_band = data['@DEADBAND'].value || 0;

    const text_modes = data['@MODE'].constraints.enumText;

    this.modes.clear();
    if (text_modes) {
      text_modes.forEach((textMode: string, index: number) => {
        const mode = this._modeFromString(textMode);
        if (mode !== ThermostatOperationMode.UNKNOWN) {
          this.modes.set(index, mode);
        }
      });
    }

    this.current_mode = this.modes.get(data['@MODE'].value) ?? ThermostatOperationMode.UNKNOWN;

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

    if (data['@HUMIDITY']) {
      this.current_humidity = data['@HUMIDITY'];
      this.api.log.debug(strings.humidityState, this.deviceName, this.current_humidity);
    }

    if (data['@SETPOINT']) {
      this.current_temp = data['@SETPOINT'];
      this.api.log.debug(strings.currentTempState, this.deviceName, this.current_temp);
    }

    if (data['@COOLSETPOINT']) {
      this.cool_set_point = data['@COOLSETPOINT'];
      this.api.log.debug(strings.coolSetpoint, this.deviceName, this.cool_set_point);
    }

    if (data['@HEATSETPOINT']) {
      this.heat_set_point = data['@HEATSETPOINT'];
      this.api.log.debug(strings.heatSetpoint, this.deviceName, this.heat_set_point);
    }

    if (data['@MODE']) {
      const modeIndex = getValue(data['@MODE']);
      this.current_mode = this.modes.get(modeIndex) ?? ThermostatOperationMode.UNKNOWN;
      this.api.log.debug(strings.modeState, this.deviceName, this._stringFromMode(this.current_mode) ?? 'UNKNOWN');
    }

    if (data['@RUNNINGSTATUS']) {
      this.running = data['@RUNNINGSTATUS'].replace(/\s/g, '').length > 0;
      this.api.log.debug(strings.runningState, this.deviceName, this.running);
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
      this.api.log.error(strings.unknownMode, strValue);
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
      this.api.publish(payload, this.deviceId, this.serialNumber);
    } else {
      this.api.log.error(strings.unknownMode, mode);
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
        this.api.log.error(strings.outOfRangeCool, lower, upper, temp);
      }
    }

    if (targetTempHeat || (targetTemp && [ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode))) {
      const temp = targetTempHeat ?? targetTemp!;
      const [lower, upper] = this.heatSetPointLimits;
      if (lower <= temp && temp <= upper) {
        heatPayload['@HEATSETPOINT'] = temp;
      } else {
        this.api.log.error(strings.outOfRangeHeat, lower, upper, temp);
      }
    }

    let hasSetTemp = false;
    if (coolPayload && [ThermostatOperationMode.AUTO, ThermostatOperationMode.COOLING].includes(this.mode)) {
      this.api.publish(coolPayload, this.deviceId, this.serialNumber);
      hasSetTemp = true;
    }
    if (heatPayload && [ThermostatOperationMode.AUTO, ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode)) {
      this.api.publish(heatPayload, this.deviceId, this.serialNumber);
      hasSetTemp = true;
    }
    if (targetTemp && !hasSetTemp) {
      let payload = {};
      if (this.mode === ThermostatOperationMode.COOLING) {
        payload = coolPayload;
      } else if ([ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode)) {
        payload = heatPayload;
      } else {
        this.api.log.error(strings.setpointUnknown, this.mode);
      }
      if (Object.keys(payload).length > 0) {
        this.api.publish(payload, this.deviceId, this.serialNumber);
      }
    }
  }
}
