import { EconetApi } from './econet.js';
import { TemperatureUnits } from './enums.js';

export abstract class Equipment {
  private device_id?: string | null;
  private serial_number?: string | null;
  private device_name?: string | null;
  private alertCount: number = 0;
  private temp_units = TemperatureUnits.CELSIUS;
  private running: boolean = false;

  protected _api: EconetApi;

  private _onUpdateCallback: ((serialNumber: string) => void) | null = null;

  constructor(api: EconetApi) {
    this._api = api;
  }

  get deviceId(): string {
    return this.device_id || 'undefined';
  }

  get serialNumber(): string {
    return this.serial_number || 'undefined';
  }

  get deviceName(): string {
    return this.device_name || 'undefined';
  }

  get hasAlert(): boolean {
    return this.alertCount > 0;
  }

  get units() : TemperatureUnits {
    return this.temp_units;
  }

  protected abstract get runningKey(): string;

  get isRunning(): boolean {
    return this.running;
  }

  setOnUpdateCallback(callback: (serialNumber: string) => void): void {
    this._onUpdateCallback = callback;
  }

  protected didUpdate() {
    if (this._onUpdateCallback) {
      this._onUpdateCallback(this.serialNumber);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected updateFromREST(update: any): void {
    this.device_id = update.device_name;
    this.serial_number = update.serial_number;
    this.device_name = update['@NAME'].value ?? '';

    if ('@ALERTCOUNT' in update) {
      this.alertCount = update['@ALERTCOUNT'] ?? 0;
    }

    if ('@SETPOINT' in update) {
      this.temp_units = update['@SETPOINT'].constraints.units.includes('F') ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS; 
    }

    if (this.runningKey in update) {
      this.running = update[this.runningKey].replace(/\s/g, '').length > 0;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateFromMQTT(update: any): void {

    if ('@ALERTCOUNT' in update) {
      this.alertCount = update['@ALERTCOUNT'] ?? 0;
      this._api.log.debug(`${this.deviceName} alert count = ${this.alertCount}`);
    }

    if (this.runningKey in update) {
      this.running = update[this.runningKey].replace(/\s/g, '').length > 0;
      this._api.log.debug(`${this.deviceName} running = ${this.running}`);
    }
  }
}