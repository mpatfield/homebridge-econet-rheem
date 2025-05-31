import { EconetApi } from './api.js';
import { EquipmentType, TemperatureUnits } from './constants.js';
import { EquipmentData, MQTTData } from './types.js';

import strings from '../lang/en.js';

export abstract class Equipment {
  private device_id?: string | null;
  private serial_number?: string | null;
  private device_name?: string | null;
  private alert_count: number = 0;
  private temp_units = TemperatureUnits.CELSIUS;
  protected running: boolean = false;

  private _onUpdateCallback: ((serialNumber: string) => void) | null = null;

  constructor(readonly api: EconetApi, data: EquipmentData) {
    this.device_id = data.device_name;
    this.serial_number = data.serial_number;
    this.device_name = data['@NAME']?.value ?? strings.brand;
    this.alert_count = data['@ALERTCOUNT'] ?? 0;
    this.temp_units = data['@SETPOINT']?.constraints?.units?.includes('F') ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS;
  }

  abstract get type(): EquipmentType;

  get deviceId(): string {
    return this.device_id || strings.undefined;
  }

  get serialNumber(): string {
    return this.serial_number || strings.undefined;
  }

  get deviceName(): string {
    return this.device_name || strings.undefined;
  }

  get hasAlert(): boolean {
    return this.alert_count > 0;
  }

  get units() : TemperatureUnits {
    return this.temp_units;
  }

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

  updateFromMQTT(update: MQTTData): void {

    if (update['@ALERTCOUNT'] !== undefined) {
      this.alert_count = update['@ALERTCOUNT'];
      this.api.log.debug(strings.alertCount, this.deviceName, this.alert_count);
    }
  }
}