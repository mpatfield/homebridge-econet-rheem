import { EconetApi } from './api.js';
import { EquipmentType, TemperatureUnits } from './constants.js';
import { DeviceMQTTData, EquipmentData, UserMQTTData } from './types.js';

import { strings } from '../i18n/i18n.js';

import { Log } from '../tools/log.js';

export abstract class Equipment {
  private device_id?: string | null;
  private serial_number?: string | null;
  private mac_address?: string | null;
  private device_name?: string | null;
  private alert_count: number = 0;
  private temp_units = TemperatureUnits.CELSIUS;
  protected running: boolean = false;

  private _onUpdateCallback: ((serialNumber: string) => void) | null = null;

  constructor(private readonly api: EconetApi, data: EquipmentData) {
    this.device_id = data.device_name;
    this.serial_number = data.serial_number;
    this.mac_address = data.mac_address;
    this.device_name = data['@NAME']?.value ?? strings.general.brand;
    this.alert_count = data['@ALERTCOUNT'] ?? 0;
    this.temp_units = data['@SETPOINT']?.constraints?.units?.includes('F') ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS;
  }

  abstract get type(): EquipmentType;

  get deviceId(): string {
    return this.device_id || strings.general.undefined;
  }

  get serialNumber(): string {
    return this.serial_number || strings.general.undefined;
  }

  get macAddress(): string {
    return this.mac_address || strings.general.undefined;
  }

  get deviceName(): string {
    return this.device_name || strings.general.undefined;
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

  protected get log(): Log {
    return this.api.log;
  }

  setOnUpdateCallback(callback: (serialNumber: string) => void): void {
    this._onUpdateCallback = callback;
  }

  protected didUpdate() {
    if (this._onUpdateCallback) {
      this._onUpdateCallback(this.serialNumber);
    }
  }

  updateFromUserMQTT(update: UserMQTTData): void {

    if (update['@ALERTCOUNT'] !== undefined) {
      this.alert_count = update['@ALERTCOUNT'];
      this.log.ifVerbose(strings.debug.alertCount, this.deviceName, this.alert_count);
    }
  }

  abstract updateFromDeviceMQTT(_update: DeviceMQTTData): void;

  publish(userPayload: { [key: string]: number | string}, devicePayload: { [key: string]: number | string } | undefined) {
    
    userPayload = {
      device_name: this.deviceId,
      ...userPayload,
    };

    this.api.publish(this.serialNumber, userPayload, devicePayload);
  }
}