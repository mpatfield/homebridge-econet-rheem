import { Equipment } from './equipment.js';
import { EconetApi } from './econet.js';
import { ThermostatOperationMode, TemperatureUnits } from './enums.js';

export class Thermostat extends Equipment {

  private enabled: boolean = false;
  private running: boolean = false;

  private cool_set_point = 0;
  private cool_lower_limit = 0;
  private cool_upper_limit = 0;

  private heat_set_point = 0;
  private heat_lower_limit = 0;
  private heat_upper_limit = 0;

  private dead_band = 0;

  private text_modes: string[] = [];
  private supported_modes: ThermostatOperationMode[] = [];
  private current_mode = ThermostatOperationMode.UNKNOWN;

  private temp_units = TemperatureUnits.CELSIUS;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(api: EconetApi, restUpdate: any) {
    super(api);
    this.updateFromREST(restUpdate);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentTemp(): number {
    return this.dead_band;
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

  get modes(): ThermostatOperationMode[] {
    return this.supported_modes;
  }

  get mode(): ThermostatOperationMode {
    return this.current_mode;
  }

  get units() : TemperatureUnits {
    return this.temp_units;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected updateFromREST(update: any): void {
    super.updateFromREST(update);

    this.enabled = update['@ENABLED']?.value === 1;
    this.running = update['@RUNNINGSTATUS'] !== '';

    this.cool_set_point = update['@COOLSETPOINT']?.value || 0;
    
    const coolLimits = update['@COOLSETPOINT']?.constraints;
    if (coolLimits) {
      this.cool_lower_limit = coolLimits.lowerLimit;
      this.cool_upper_limit = coolLimits.upperLimit;
    }

    this.heat_set_point = update['@HEATSETPOINT']?.value || 0;

    const heatLimits = update['@HEATSETPOINT']?.constraints;
    if (heatLimits) {
      this.heat_lower_limit = heatLimits.lowerLimit;
      this.heat_upper_limit = heatLimits.upperLimit;
    }

    this.dead_band = update['@DEADBAND']?.value || 0;

    this.text_modes = update['@MODE']?.constraints.enumText;

    this.supported_modes = [];
    const modes = update['@MODE']?.constraints.enumText;
    if (modes) {
      for (const mode of modes) {
        const opMode = this._modeFromString(mode);
        if (opMode !== ThermostatOperationMode.UNKNOWN) {
          this.supported_modes.push(opMode);
        }
      }
    }

    this.current_mode = this.modes[update['@MODE']?.value] ?? ThermostatOperationMode.UNKNOWN;

    this.temp_units = update['@DEADBAND']?.constraints.units === 'deg F' ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS;

    this.didUpdate();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateFromMQTT(update: any): void {

    if ('@ENABLED' in update) {
      this.enabled = update['@ENABLED'] === 1 || update['@ENABLED']?.value === 1;
      this._api.log.debug(`${this.deviceName} enabled = ${this.enabled}`);
    }

    this._api.log.error('MQTT not yet implemented on thermostat: ', JSON.stringify(update, null, 2));

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

  setEnabled(enabled: boolean): void {
    this._api.publish({ '@ENABLED': enabled ? 1 : 0 }, this.deviceId, this.serialNumber);
  }

  setMode(mode: ThermostatOperationMode): void {
    const payload: { [key: string]: number } = {};

    this.text_modes.forEach((textMode: string, index: number) => {
      if (mode === this._modeFromString(textMode)) {
        payload['@MODE'] = index;
      }
    });

    if (Object.keys(payload).length > 0) {
      this._api.publish(payload, this.deviceId, this.serialNumber);
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
