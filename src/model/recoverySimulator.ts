import path from 'path';

import { EconetApi } from './econet.js';
import { fromCelsius, ONE_HOUR, safeGetItem, safeSetItem } from './utils.js';
import { WaterHeater } from './waterHeater.js';

const DEFAULT_RECOVERY_RATE = 30; // in degrees Celsius per hour
const RECOVERY_TIMER_INTERVAL = 300000; // 5 minutes

export class RecoverySimulator {

  private readonly recoveryRatesFilePath: string;
  private recoveryRates: number[];

  private recoveryTimer: NodeJS.Timeout | null = null;

  private readonly serialNumber: string;

  private setPoint: number;
  private availability: number;

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
    this.recoveryRates = this._loadRecoveryRates() ?? [fromCelsius(DEFAULT_RECOVERY_RATE, waterHeater.units)];
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
    const previousSetPoint = this.previousSetPoint;

    this.setPoint = waterHeater.setPoint;
    this.availability = waterHeater.availability;
    this.previousSetPoint = waterHeater.setPoint;

    if (this.availability === 0 && !waterHeater.isRunning) {
      this._stopRecoveryTimer();
      return;
    }

    if (waterHeater.isRunning && !this.isRecovering) {
      if (this.availability === 0 || this.setPoint > previousSetPoint) {
        this._startRecoveryTimer();
      }
      return;
    }

    if (this.isRecovering && this.simulatedTemp >= this.setPoint) {
      this.simulatedTemp = this.setPoint;
      this._endRecovery();
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

    const tempIncrease = this.recoveryRate * (RECOVERY_TIMER_INTERVAL / ONE_HOUR);
    this.simulatedTemp = Math.min(this.simulatedTemp + tempIncrease, this.setPoint);

    if (this.simulatedTemp === this.setPoint) {
      this._recordRecoveryRate();
      this._stopRecoveryTimer();
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

    const timeElapsed = (Date.now() - this.recoveryStartTime) / ONE_HOUR;
    const tempDifference = this.setPoint - this.recoveryStartTemp;

    if (timeElapsed <= 0) {
      return;
    }

    const rate = tempDifference / timeElapsed;
    this.recoveryRates.push(rate);

    if (this.recoveryRates.length > 3) {
      this.recoveryRates.shift();
    }

    this._saveRecoveryRates();
  }

  private _loadRecoveryRates(): number[] | null {
    const key = `whRecoveryRates_${this.serialNumber}`;
    const stored = safeGetItem(this.recoveryRatesFilePath, key);
    return stored ? JSON.parse(stored) : null;
  }

  private _saveRecoveryRates(): void {
    const key = `whRecoveryRates_${this.serialNumber}`;
    safeSetItem(this.recoveryRatesFilePath, key, JSON.stringify(this.recoveryRates));
  }
}