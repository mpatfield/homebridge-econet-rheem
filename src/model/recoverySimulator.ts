import path from 'path';

import { EconetApi } from './econet.js';
import { fromCelsius, HOUR, MINUTE, safeGetItem, safeSetItem } from './utils.js';
import { WaterHeater } from './waterHeater.js';

const RECOVERY_FILE_PREFIX = 'whRecoveryRates_';

// in degrees Celsius per hour
const DEFAULT_RECOVERY_RATE = 20;
const MINIMUM_RECOVERY_RATE = 5;

const RECOVERY_TIMER_INTERVAL = 2 * MINUTE;

export class RecoverySimulator {

  private readonly recoveryRatesFilePath: string;
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
    private readonly api: EconetApi,
    waterHeater: WaterHeater,
    private readonly onUpdate: () => void,
  ) {

    this.serialNumber = waterHeater.serialNumber;

    this.availability = waterHeater.availability;
    this.setPoint = waterHeater.setPoint;
    this.previousSetPoint = this.setPoint;

    this.simulatedTemp = this.setPoint;

    this.recoveryRatesFilePath = path.join(api.storagePath, 'recoveryRates.json');

    const minRecoveryRate = fromCelsius(MINIMUM_RECOVERY_RATE, waterHeater.units);
    const defaultRecoveryRate = fromCelsius(DEFAULT_RECOVERY_RATE, waterHeater.units);
    this.recoveryRates = this._loadRecoveryRates()?.filter(x => x > minRecoveryRate)  ?? [defaultRecoveryRate];
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

    if (this.availability === 0 && !waterHeater.isRunning) {
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

    if (waterHeater.isRunning && !this.isRecovering &&
      (this.availability === 0 || this.setPoint > this.previousSetPoint)) {
      this._startRecoveryTimer();
      return;
    }

    if (!waterHeater.isRunning && this.isRecovering) {
      if (this.simulatedTemp >= this.setPoint) {
        this._endRecovery();
      } else {
        this._stopRecoveryTimer();
      }
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

    if (this.simulatedTemp === this.setPoint) {
      this._endRecovery();
    }

    this.onUpdate();
  }

  private _endRecovery() {
    this._recordRecoveryRate();
    this._stopRecoveryTimer();
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
    if (rate < MINIMUM_RECOVERY_RATE) {
      return;
    }

    this.recoveryRates.push(rate);

    if (this.recoveryRates.length > 3) {
      this.recoveryRates.shift();
    }

    this._saveRecoveryRates();
  }

  private _loadRecoveryRates(): number[] | null {
    const key = `${RECOVERY_FILE_PREFIX}${this.serialNumber}`;
    const stored = safeGetItem(this.recoveryRatesFilePath, key);
    return stored ? JSON.parse(stored) : null;
  }

  private _saveRecoveryRates(): void {
    const key = `${RECOVERY_FILE_PREFIX}${this.serialNumber}`;
    safeSetItem(this.recoveryRatesFilePath, key, JSON.stringify(this.recoveryRates));
  }
}