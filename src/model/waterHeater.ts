import { EconetApi } from './api.js';
import { EquipmentType } from './constants.js';
import { Equipment } from './equipment.js';
import { RecoverySimulator } from './recoverySimulator.js';
import { EquipmentData, getValue, MQTTData, WaterHeaterData } from './types.js';

import { strings } from '../i18n/i18n.js';

import { fromCelsius } from '../tools/temperature.js';

const DEFAULT_LOWER_LIMIT = 35;
const DEFAULT_UPPER_LIMIT = 65;
const DEFAULT_SETPOINT = 50;

export class WaterHeater extends Equipment {

  private enabled: boolean = true;

  private lower_limit = 0;
  private upper_limit = 0;
  private set_point = 0;

  private availability_icon: string | null = null;

  private recoverySimulator: RecoverySimulator;

  constructor(api: EconetApi, data: WaterHeaterData) {
    super(api, data as unknown as EquipmentData);

    this.recoverySimulator = new RecoverySimulator(this, () => {
      this.didUpdate();
    });

    this.running = data['@RUNNING'] ? data['@RUNNING']?.replace(/\s/g, '').length > 0 : false;
    this.enabled = data['@ENABLED']?.value === 1;

    this.lower_limit = data['@SETPOINT']?.constraints.lowerLimit ?? fromCelsius(DEFAULT_LOWER_LIMIT, this.units);
    this.upper_limit = data['@SETPOINT']?.constraints.upperLimit ?? fromCelsius(DEFAULT_UPPER_LIMIT, this.units);
    this.set_point = data['@SETPOINT']?.value ?? fromCelsius(DEFAULT_SETPOINT, this.units);

    this.availability_icon = data['@HOTWATER'] ?? '';

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
    this.recoverySimulator?.handleUpdate(this);
    super.didUpdate();
  }
 
  updateFromUserMQTT(data: MQTTData): void {
    super.updateFromUserMQTT(data);
 
    if (data['@ENABLED'] !== undefined) {
      this.enabled = getValue(data['@ENABLED']) === 1;
      this.log.ifVerbose(strings.debug.enabledState, this.deviceName, this.enabled);
    }

    if (data['@SETPOINT'] !== undefined) {
      this.set_point = data['@SETPOINT'];
      this.log.ifVerbose(strings.debug.setpointState, this.deviceName, this.set_point);
    }

    if (data['@HOTWATER'] !== undefined) {
      this.availability_icon = data['@HOTWATER'];
      this.log.ifVerbose(strings.debug.availabilityState, this.deviceName, this.availability_icon);
    }

    if (data['@RUNNING'] !== undefined) {
      this.running = data['@RUNNING'].replace(/\s/g, '').length > 0;
      this.log.ifVerbose(strings.debug.runningState, this.deviceName, this.running);
    }

    this.didUpdate();  
  }

  setEnabled(enabled: boolean): void {
    this.publish({ '@ENABLED': enabled ? 1 : 0 }, this.deviceId, this.serialNumber);
  }

  setSetPoint(setPoint: number): void {
    this.publish({ '@SETPOINT': setPoint }, this.deviceId, this.serialNumber);
  }
}