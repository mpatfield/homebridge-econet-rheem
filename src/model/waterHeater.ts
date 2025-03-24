import { Equipment } from './equipment.js';
import { EconetApi } from './econet.js';
import { TemperatureUnits } from './enums.js';

export class WaterHeater extends Equipment {

  private enabled: boolean = false;
  private running: boolean = false;

  private temp_units = TemperatureUnits.CELSIUS;

  private lower_limit = 100;
  private upper_limit = 150;
  private set_point = 0;

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

  get units() : TemperatureUnits {
    return this.temp_units;
  }

  get limits(): [number, number] {
    return [this.lower_limit, this.upper_limit];
  }

  // Currently not supplied by Econet api
  get currentTemp(): number {
    return this.set_point;
  }

  get setPoint(): number {
    return this.set_point;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected updateFromREST(update: any): void {
    super.updateFromREST(update);

    this.enabled = update['@ENABLED']?.value === 1;
    this.running = update['@RUNNING'].replace(/\s/g, '').length > 0;

    this.temp_units = update['@SETPOINT']?.constraints.units === 'deg F' ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS;

    this.lower_limit = update['@SETPOINT']?.constraints.lowerLimit || 100;
    this.upper_limit = update['@SETPOINT']?.constraints.upperLimit || 150;
    this.set_point = update['@SETPOINT']?.value || 0;

    this.didUpdate();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateFromMQTT(update: any): void {
    
    if ('@ENABLED' in update) {
      this.enabled = update['@ENABLED'] === 1 || update['@ENABLED']?.value === 1;
      this._api.log.debug(`${this.deviceName} enabled = ${this.enabled}`);
    }

    if ('@RUNNING' in update) {
      this.running = update['@RUNNING'].replace(/\s/g, '').length > 0;
      this._api.log.debug(`${this.deviceName} running = ${this.running}`);
    }

    if ('@SETPOINT' in update) {
      this.set_point = update['@SETPOINT'];
      this._api.log.debug(`${this.deviceName} set_point = ${this.set_point}`);
    }

    this.didUpdate();  
  }

  setEnabled(enabled: boolean): void {
    this._api.publish({ '@ENABLED': enabled ? 1 : 0 }, this.deviceId, this.serialNumber);
  }

  setSetPoint(setPoint: number): void {
    this._api.publish({ '@SETPOINT': setPoint }, this.deviceId, this.serialNumber);
  }
}