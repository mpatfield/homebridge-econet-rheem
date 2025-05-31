import { TemperatureUnits } from './constants.js';
import { WaterHeater } from './waterHeater.js';

import { HOUR, MINUTE } from '../tools/time.js';
import { safeGetItem, safeSetItem, STORAGE_KEY_RECOVERY_RATES } from '../tools/storage.js';

// in degrees Celsius per hour
const DEFAULT_RECOVERY_RATE = 20;
const MINIMUM_RECOVERY_RATE = 1;

const RECOVERY_TIMER_INTERVAL = 2 * MINUTE;

export class RecoverySimulator {

  private readonly minRecoveryRate: number;
  private readonly defaultRecoveryRate: number;
  private recoveryRates: number[];

  private recoveryTimer: NodeJS.Timeout | null = null;

  private readonly serialNumber: string;

  private availability: number;
  private setPoint: number;

  private previousSetPoint: number;

  private simulatedTemp: number;

  private recoveryStartTime: number | null = null;
  private recoveryStartTemp: number | null = null;

  constructor(
    readonly waterHeater: WaterHeater,
    private readonly onUpdate: () => void,
  ) {

    this.serialNumber = waterHeater.serialNumber;

    this.availability = waterHeater.availability;
    this.setPoint = waterHeater.setPoint;
    this.previousSetPoint = this.setPoint;

    this.simulatedTemp = this.setPoint;

    this.minRecoveryRate = MINIMUM_RECOVERY_RATE * (waterHeater.units === TemperatureUnits.FAHRENHEIT ? 1.8 : 1);
    this.defaultRecoveryRate = DEFAULT_RECOVERY_RATE * (waterHeater.units === TemperatureUnits.FAHRENHEIT ? 1.8 : 1);
    this.recoveryRates = this._loadRecoveryRates() ?? [this.defaultRecoveryRate];
  }

  currentTemp(inputTemp: number): number {

    if (this.availability === 0 && !this.isRecovering) {
      this.simulatedTemp = inputTemp;
    }

    return this.simulatedTemp;
  }

  private get isRecovering(): boolean {
    return this.recoveryTimer !== null;
  }

  handleUpdate(waterHeater: WaterHeater): void {

    if (this.setPoint !== waterHeater.setPoint) {
      this.previousSetPoint = this.setPoint;
      this.setPoint = waterHeater.setPoint;
    }

    this.availability = waterHeater.availability;

    if (waterHeater.isRunning && !this.isRecovering &&
      (this.availability === 0 || this.setPoint > this.previousSetPoint)) {
      this._startRecoveryTimer();
      return;
    }

    if (!waterHeater.isRunning && this.availability === 0) {
      this._stopRecoveryTimer();
      this.onUpdate();
      return;
    }

    if (this.setPoint < this.previousSetPoint && this.setPoint < this.simulatedTemp) {
      this._stopRecoveryTimer();

      this.simulatedTemp = this.setPoint;
      this.onUpdate();

      return;
    }

    if (!waterHeater.isRunning && this.isRecovering) {
      this._recordRecoveryRate();
      this._stopRecoveryTimer();

      this.simulatedTemp = this.setPoint;
      this.onUpdate();

      return;
    }    
  }

  private get recoveryRate(): number {
    return this.recoveryRates.reduce((a, b) => a + b, 0) / this.recoveryRates.length;
  }

  private _startRecoveryTimer(): void {

    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
    }

    this.recoveryStartTime = Date.now();
    this.recoveryStartTemp = this.simulatedTemp;

    this.recoveryTimer = setInterval(() => {
      this._updateSimulatedTemp();
    }, RECOVERY_TIMER_INTERVAL);
  }

  private _stopRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private _updateSimulatedTemp(): void {

    if (!this.isRecovering) {
      return;
    }

    const tempIncrease = this.recoveryRate * (RECOVERY_TIMER_INTERVAL / HOUR);
 
    this.simulatedTemp = Math.min(this.simulatedTemp + tempIncrease, this.setPoint);
    this.onUpdate();
  }

  private _recordRecoveryRate() {

    if (!this.recoveryStartTime || !this.recoveryStartTemp) {
      return;
    }

    const timeElapsed = (Date.now() - this.recoveryStartTime) / HOUR;
    const tempDifference = this.setPoint - this.recoveryStartTemp;

    this.recoveryStartTime = null;
    this.recoveryStartTemp = null;

    if (timeElapsed <= 0) {
      return;
    }

    const rate = tempDifference / timeElapsed;
    if (rate < this.minRecoveryRate) {
      return;
    }

    this.recoveryRates.push(rate);

    if (this.recoveryRates.length > 3 || (this.recoveryRates.length >= 2 && this.recoveryRates[0] === this.defaultRecoveryRate) ) {
      this.recoveryRates.shift();
    }

    this._saveRecoveryRates();
  }

  private get recoveryRatesObject(): Record<string, number[]> {
    const objectString = safeGetItem(this.waterHeater.storageFilePath, STORAGE_KEY_RECOVERY_RATES);
    return  objectString ? JSON.parse(objectString) : {};
  }

  private _loadRecoveryRates(): number[] | null {
    return this.recoveryRatesObject[this.serialNumber];
  }

  private _saveRecoveryRates(): void {
    const ratesObject = this.recoveryRatesObject;
    ratesObject[this.serialNumber] = this.recoveryRates;
    safeSetItem(this.waterHeater.storageFilePath, STORAGE_KEY_RECOVERY_RATES, JSON.stringify(ratesObject));
  }
}