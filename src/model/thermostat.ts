import { Equipment } from './equipment.js';
import { EconetApi } from './econet.js';
import { ThermostatOperationMode, TemperatureUnits } from './enums.js';

export class Thermostat extends Equipment {

  private running: boolean = false;

  private temp_units = TemperatureUnits.CELSIUS;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(api: EconetApi, restUpdate: any) {
    super(api);
    this.updateFromREST(restUpdate);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get units() : TemperatureUnits {
    return this.temp_units;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected updateFromREST(update: any): void {
    super.updateFromREST(update);

    if ('@RUNNINGSTATUS' in update) {
      this.running = update['@RUNNINGSTATUS'].replace(/\s/g, '').length > 0;
    }

    if ('@HUMIDITY' in update) {
      this.current_humidity = update['@HUMIDITY'].value || 0;
    }

    if ('@SETPOINT' in update) {
      this.temp_units = update['@SETPOINT'].constraints.units === 'deg F' ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS; 
      this.current_temp = update['@SETPOINT'].value || 70;
    }

    if ('@COOLSETPOINT' in update) {
      this.cool_lower_limit = update['@COOLSETPOINT'].constraints.lowerLimit || 50;
      this.cool_upper_limit = update['@COOLSETPOINT'].constraints.upperLimit || 90;
      this.cool_set_point = update['@COOLSETPOINT'].value || 70;
    }

    if ('@HEATSETPOINT' in update) {
      this.heat_lower_limit = update['@HEATSETPOINT'].constraints.lowerLimit || 50;
      this.heat_upper_limit = update['@HEATSETPOINT'].constraints.upperLimit || 90;
      this.heat_set_point = update['@HEATSETPOINT'].value || 70;
    }

    this.dead_band = update['@DEADBAND']?.value || 0;

    const text_modes = update['@MODE']?.constraints.enumText;

    this.modes.clear();
    if (text_modes) {
      text_modes.forEach((textMode: string, index: number) => {
        const mode = this._modeFromString(textMode);
        if (mode !== ThermostatOperationMode.UNKNOWN) {
          this.modes.set(index, mode);
        }
      });
    }

    this.current_mode = this.modes.get(update['@MODE']?.value) ?? ThermostatOperationMode.UNKNOWN;

    this.didUpdate();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateFromMQTT(update: any): void {

    if ('@RUNNINGSTATUS' in update) {
      this.running = update['@RUNNINGSTATUS'].replace(/\s/g, '').length > 0;
      this._api.log.debug(`${this.deviceName} running = ${this.running}`);
    }

    if ('@HUMIDITY' in update) {
      this.current_humidity = update['@HUMIDITY'] || 0;
      this._api.log.debug(`${this.deviceName} humidity = ${this.current_humidity}`);
    }

    if ('@SETPOINT' in update) {
      this.current_temp = update['@SETPOINT'] || 70;
      this._api.log.debug(`${this.deviceName} current temp = ${this.current_temp}`);
    }

    if ('@COOLSETPOINT' in update) {
      this.cool_set_point = update['@COOLSETPOINT'] || 70;
      this._api.log.debug(`${this.deviceName} cool setpoint = ${this.cool_set_point}`);
    }

    if ('@HEATSETPOINT' in update) {
      this.heat_set_point = update['@HEATSETPOINT'] || 70;
      this._api.log.debug(`${this.deviceName} heat setpoint = ${this.heat_set_point}`);
    }

    if ('@MODE' in update) {
      const modeIndex = update['@MODE'] ?? update['@MODE'].value;
      this.current_mode = this.modes.get(modeIndex) ?? ThermostatOperationMode.UNKNOWN;
      this._api.log.debug(`${this.deviceName} mode = ${this._stringFromMode(this.current_mode) ?? 'UNKNOWN'}`);
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
      this._api.log.error('Unknown thermostat mode:', strValue);
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
      this._api.publish(payload, this.deviceId, this.serialNumber);
    } else {
      this._api.log.error('Unknown thermostat mode:', mode);
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
        this._api.log.error(`Cool set point out of range. Lower: ${lower}, Upper: ${upper}, Set point: ${temp}`);
      }
    }

    if (targetTempHeat || (targetTemp && [ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode))) {
      const temp = targetTempHeat ?? targetTemp!;
      const [lower, upper] = this.heatSetPointLimits;
      if (lower <= temp && temp <= upper) {
        heatPayload['@HEATSETPOINT'] = temp;
      } else {
        this._api.log.error(`Heat set point out of range. Lower: ${lower}, Upper: ${upper}, Set point: ${temp}`);
      }
    }

    let hasSetTemp = false;
    if (coolPayload && [ThermostatOperationMode.AUTO, ThermostatOperationMode.COOLING].includes(this.mode)) {
      this._api.publish(coolPayload, this.deviceId, this.serialNumber);
      hasSetTemp = true;
    }
    if (heatPayload && [ThermostatOperationMode.AUTO, ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode)) {
      this._api.publish(heatPayload, this.deviceId, this.serialNumber);
      hasSetTemp = true;
    }
    if (targetTemp && !hasSetTemp) {
      let payload = {};
      if (this.mode === ThermostatOperationMode.COOLING) {
        payload = coolPayload;
      } else if ([ThermostatOperationMode.HEATING, ThermostatOperationMode.EMERGENCY_HEAT].includes(this.mode)) {
        payload = heatPayload;
      } else {
        this._api.log.error(`Can't auto determine set point to set when mode is: ${this.mode}`);
      }
      if (Object.keys(payload).length > 0) {
        this._api.publish(payload, this.deviceId, this.serialNumber);
      }
    }
  }
}
