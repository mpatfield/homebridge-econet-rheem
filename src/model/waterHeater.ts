import { Equipment } from './equipment.js';
import { EconetApi } from './econet.js';
import { TemperatureUnits } from './enums.js';

import path from 'path';
import { safeGetItem, safeSetItem } from './utils.js';

export class WaterHeater extends Equipment {

  private enabled: boolean = false;
  private running: boolean = false;

  private temp_units = TemperatureUnits.CELSIUS;

  private lower_limit = 100;
  private upper_limit = 150;
  private set_point = 0;

  private availability = 100;
  private nextAvailability = 100;

  private readonly recoveryRatesFilePath: string;
  private recoveryRates: number[] = [];
  private lastAvailabilityUpdate: number = 0;
  private lastAvailabilityValue: number = 100;

  private recoveryTimer: NodeJS.Timeout | null = null;
  private currentTempEstimate: number | null = null;

  private inputTemp: number | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(api: EconetApi, storagePath: string, restUpdate: any) {
    super(api, storagePath);
    this.recoveryRatesFilePath = path.join(process.cwd(), 'recoveryRates.json');;
    this.recoveryRates = this._loadRecoveryRates();
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

  currentTemp(inputTemp?: number | null): number {

    if (!inputTemp) {
      return this.set_point;
    }

    this.inputTemp = inputTemp;
    const minCurrentTemp = Math.round(this.inputTemp + (this.availability / 100) * (this.set_point - this.inputTemp));
    const recoveryRate = this.recoveryRate;

    if (this.currentTempEstimate == null && recoveryRate != null) {
      this.currentTempEstimate = minCurrentTemp;
      this._startRecoveryTimer();
    }

    return this.currentTempEstimate ?? minCurrentTemp;
  }

  get setPoint(): number {
    return this.set_point;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected updateFromREST(update: any): void {
    super.updateFromREST(update);

    if ('@ENABLED' in update) {
      this.enabled = update['@ENABLED'].value === 1;
    }

    if ('@RUNNING' in update) {
      this.running = update['@RUNNING'].replace(/\s/g, '').length > 0;
    }

    if ('@SETPOINT' in update) {

      this.temp_units = update['@SETPOINT'].constraints.units === 'deg F' ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS;

      this.lower_limit = update['@SETPOINT'].constraints.lowerLimit || 100;
      this.upper_limit = update['@SETPOINT'].constraints.upperLimit || 150;
      this.set_point = update['@SETPOINT'].value || 0;
    }

    if ('@HOTWATER' in update) {
      this.availability = this._availabilityFromIcon(update['@HOTWATER']);
    }

    this.didUpdate();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateFromMQTT(update: any): void {
    
    if ('@ENABLED' in update) {
      this.enabled = update['@ENABLED'] === 1 || update['@ENABLED'].value === 1;
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

    if ('@HOTWATER' in update) {
      this.availability = this._availabilityFromIcon(update['@HOTWATER']);
    }

    this.didUpdate();  
  }

  setEnabled(enabled: boolean): void {
    this._api.publish({ '@ENABLED': enabled ? 1 : 0 }, this.deviceId, this.serialNumber);
  }

  setSetPoint(setPoint: number): void {
    this._api.publish({ '@SETPOINT': setPoint }, this.deviceId, this.serialNumber);
  }

  private _availabilityFromIcon(icon: string): number {
    this._api.log.debug('Fetching availability for icon: ', icon);

    const prevAvailability = this.lastAvailabilityValue;

    let newAvailability = 100;
    let nextAvailability = 100;
    if (icon.includes('empty') || icon.includes('zero')) {
      newAvailability = 0;
      nextAvailability = 10;
    } else if (icon.includes('ten')) {
      newAvailability = 10;
      nextAvailability = 40;
    } else if (icon.includes('fourty')) {
      newAvailability = 40;
    } else if (icon.includes('hundred') || icon.includes('hundread')) {
      newAvailability = 100;
    } else {
      newAvailability = 100;
    }

    this.nextAvailability = nextAvailability;

    const now = Date.now();
    const elapsedMinutes = (now - this.lastAvailabilityUpdate) / 60000;

    if (newAvailability > this.lastAvailabilityValue && elapsedMinutes > 0) {
      const baseTemp = this.set_point;
      const tempIncrease = (baseTemp - baseTemp * (prevAvailability / 100)) * (newAvailability - prevAvailability) / (100 - prevAvailability);
      const newRecoveryRate = tempIncrease / elapsedMinutes;

      this.recoveryRates.push(newRecoveryRate);
      if (this.recoveryRates.length > 3) {
        this.recoveryRates.shift();
      }

      this._saveRecoveryRates();
      this._api.log.debug(`${this.deviceName} recovery rate = ${this.recoveryRate} degrees/minute`);

      this.lastAvailabilityUpdate = now;
    }

    this.availability = newAvailability;
    this.lastAvailabilityValue = newAvailability;

    return newAvailability;
  }

  private get recoveryRate(): number | null {

    if (this.recoveryRates.length === 0) {
      return null;
    }

    return this.recoveryRates.reduce((a, b) => a + b, 0) / this.recoveryRates.length;
  }

  private _saveRecoveryRates(): void {
    const key = `whRecoveryRates_${this.serialNumber}`;
    safeSetItem(this.recoveryRatesFilePath, key, JSON.stringify(this.recoveryRates));
  }

  private _loadRecoveryRates(): number[] {
    const key = `whRecoveryRates_${this.serialNumber}`;
    const stored = safeGetItem(this.recoveryRatesFilePath, key);
    return stored ? JSON.parse(stored) : [];
  }

  private _startRecoveryTimer(): void {

    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
    }

    this.recoveryTimer = setInterval(() => {
      this._updateCurrentTempEstimate();
    }, 60000);
  }

  private _stopRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private _updateCurrentTempEstimate() {

    if (this.currentTempEstimate == null || this.recoveryRate == null || this.inputTemp == null) {
      this._api.log.error('Unable to update current temp estimate');
      this._stopRecoveryTimer();
      return;
    }

    const ceiling = Math.round(this.inputTemp + (this.nextAvailability / 100) * (this.set_point - this.inputTemp));
    const oldEstimate = this.currentTempEstimate;
    const newEstimate = this.currentTempEstimate + this.recoveryRate;

    if (newEstimate > ceiling) {
      this.currentTempEstimate = ceiling;
      this._stopRecoveryTimer();
    }

    if (oldEstimate !== this.currentTempEstimate) {
      this.didUpdate();
    }
  }
}