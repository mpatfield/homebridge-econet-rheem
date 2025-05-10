import { EconetApi } from './econet.js';

export abstract class Equipment {
  private device_id?: string | null;
  private serial_number?: string | null;
  private device_name?: string | null;

  protected _api: EconetApi;
  protected _storagePath: string;

  private _onUpdateCallback: ((serialNumber: string) => void) | null = null;

  constructor(api: EconetApi, storagePath: string) {
    this._api = api;
    this._storagePath = storagePath;
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
    this.device_name = update['@NAME'].value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract updateFromMQTT(update: any): void;
}