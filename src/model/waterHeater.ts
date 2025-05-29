import { EconetApi } from './api.js';
import { Equipment } from './equipment.js';
import { RecoverySimulator } from './recoverySimulator.js';

import strings from '../lang/en.js';
import { EquipmentData, getValue, MQTTData, WaterHeaterData } from './types.js';
import { EquipmentType } from './constants.js';

export class WaterHeater extends Equipment {

  private enabled: boolean = true;

  private lower_limit = 100;
  private upper_limit = 150;
  private set_point = 0;

  private availability_icon: string | null = null;

  private recoverySimulator: RecoverySimulator | null = null;

  constructor(api: EconetApi, data: WaterHeaterData, readonly storageFilePath: string) {
    super(api, data as unknown as EquipmentData);

    this.running = data['@RUNNING'].replace(/\s/g, '').length > 0;
    this.enabled = data['@ENABLED'].value === 1;

    this.lower_limit = data['@SETPOINT'].constraints.lowerLimit;
    this.upper_limit = data['@SETPOINT'].constraints.upperLimit;
    this.set_point = data['@SETPOINT'].value;

    this.availability_icon = data['@HOTWATER'];

    this.didUpdate();
  }

  get type(): EquipmentType {
    return EquipmentType.WATER_HEATER;
  }

  get isEnabled(): boolean {
    return this.enabled;
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
      this.recoverySimulator = new RecoverySimulator(this.api, this, () => {
        super.didUpdate();
      });
    }

    this.recoverySimulator.handleUpdate(this);

    super.didUpdate();
  }
 
  updateFromMQTT(data: MQTTData): void {
    super.updateFromMQTT(data);
 
    if (data['@ENABLED']) {
      this.enabled = getValue(data['@ENABLED']) === 1;
      this.api.log.debug(strings.enabledState, this.deviceName, this.enabled);
    }

    if (data['@SETPOINT']) {
      this.set_point = data['@SETPOINT'];
      this.api.log.debug(strings.setpointState, this.deviceName, this.set_point);
    }

    if (data['@HOTWATER']) {
      this.availability_icon = data['@HOTWATER'];
      this.api.log.debug(strings.availabilityState, this.deviceName, this.availability_icon);
    }

    if (data['@RUNNING']) {
      this.running = data['@RUNNING'].replace(/\s/g, '').length > 0;
      this.api.log.debug(strings.runningState, this.deviceName, this.running);
    }

    this.didUpdate();  
  }

  setEnabled(enabled: boolean): void {
    this.api.publish({ '@ENABLED': enabled ? 1 : 0 }, this.deviceId, this.serialNumber);
  }

  setSetPoint(setPoint: number): void {
    this.api.publish({ '@SETPOINT': setPoint }, this.deviceId, this.serialNumber);
  }
}