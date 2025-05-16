import { Equipment } from './equipment.js';
import { EconetApi } from './econet.js';
import { RecoverySimulator } from './recoverySimulator.js';

export class WaterHeater extends Equipment {

  private enabled: boolean = false;

  private lower_limit = 100;
  private upper_limit = 150;
  private set_point = 0;

  private availability_icon: string | null = null;

  private recoverySimulator: RecoverySimulator | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(api: EconetApi, restUpdate: any) {
    super(api);
    this.updateFromREST(restUpdate);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  protected get runningKey(): string {
    return '@RUNNING';
  }

  get limits(): [number, number] {
    return [this.lower_limit, this.upper_limit];
  }

  get availability(): number {

    const icon = this.availability_icon;

    if (icon == null) {
      return 100;
    }

    if (icon.includes('empty') || icon.includes('zero')) {
      return 0;
    }
    
    if (icon.includes('ten')) {
      return 10;
    }
    
    if (icon.includes('fourty')) {
      return 40;
    }
    
    if (icon.includes('hundred') || icon.includes('hundread')) {
      return 100;
    }

    return 100;
  }

  currentTemp(inputTemp?: number | null): number {

    if (!inputTemp) {
      return this.set_point;
    }

    return this.recoverySimulator?.currentTemp(inputTemp) || this.set_point;
  }

  get setPoint(): number {
    return this.set_point;
  }

  protected didUpdate() {

    if (!this.recoverySimulator) {
      this.recoverySimulator = new RecoverySimulator(this._api, this, () => {
        super.didUpdate();
      });
    }

    this.recoverySimulator.handleUpdate(this);

    super.didUpdate();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected updateFromREST(update: any): void {
    super.updateFromREST(update);

    if ('@ENABLED' in update) {
      this.enabled = update['@ENABLED'].value === 1;
    }

    if ('@SETPOINT' in update) {
      this.lower_limit = update['@SETPOINT'].constraints.lowerLimit || 100;
      this.upper_limit = update['@SETPOINT'].constraints.upperLimit || 150;
      this.set_point = update['@SETPOINT'].value || 0;
    }

    if ('@HOTWATER' in update) {
      this.availability_icon = update['@HOTWATER'];
    }

    this.didUpdate();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateFromMQTT(update: any): void {
    super.updateFromMQTT(update);
 
    if ('@ENABLED' in update) {
      this.enabled = update['@ENABLED'] === 1 || update['@ENABLED'].value === 1;
      this._api.log.debug(`${this.deviceName} enabled = ${this.enabled}`);
    }

    if ('@SETPOINT' in update) {
      this.set_point = update['@SETPOINT'];
      this._api.log.debug(`${this.deviceName} set_point = ${this.set_point}`);
    }

    if ('@HOTWATER' in update) {
      this.availability_icon = update['@HOTWATER'];
      this._api.log.debug(`${this.deviceName} availability = ${this.availability_icon}`);
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