import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { EconetRheemPlatform } from '../platform.js';
import { WaterHeater } from '../model/waterHeater.js';

import { toCelsius, fromCelsius } from '../model/utils.js';

export class WaterHeaterAccessory {
  private service: Service;
  private readonly Characteristic: typeof import('homebridge').Characteristic;

  constructor(
    private readonly platform: EconetRheemPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly waterHeater: WaterHeater,
    private readonly inputTemperature?: number | null,
  ) {
    
    this.Characteristic = platform.api.hap.Characteristic;
    const Service = platform.api.hap.Service;

    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'EcoNet')
      .setCharacteristic(this.Characteristic.Model, 'Water Heater')
      .setCharacteristic(this.Characteristic.SerialNumber, this.waterHeater.serialNumber)
      .setCharacteristic(this.Characteristic.FirmwareRevision, platform.packageVersion);

    this.service = this.accessory.getService(Service.HeaterCooler) ||
      this.accessory.addService(Service.HeaterCooler);

    this.service.setCharacteristic(this.Characteristic.Name, this.waterHeater.deviceName);

    this.service.getCharacteristic(this.Characteristic.StatusFault)
      .onGet(this.getStatusFault.bind(this));

    this.service.getCharacteristic(this.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    this.service.getCharacteristic(this.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentState.bind(this));

    this.service.getCharacteristic(this.Characteristic.TargetHeaterCoolerState)
      .setProps({ validValues: [this.Characteristic.TargetHeaterCoolerState.HEAT] })
      .onGet(this.getTargetState.bind(this))
      .onSet(this.setTargetState.bind(this));

    this.service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    const minTemp = toCelsius(this.waterHeater.limits[0], this.waterHeater.units);
    const maxTemp = toCelsius(this.waterHeater.limits[1], this.waterHeater.units);
    this.service.getCharacteristic(this.Characteristic.HeatingThresholdTemperature)
      .setProps({ minValue: minTemp, maxValue: maxTemp, minStep: 0.1 })
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    this.waterHeater.setOnUpdateCallback(this.handleEquipmentUpdate.bind(this));

    this.updateCharacteristics();
  }

  private handleEquipmentUpdate(serial: string): void {
    if (serial === this.waterHeater.serialNumber) {
      this.updateCharacteristics();
      this.platform.log.debug(`Received update for ${serial}, refreshed accessory state`);
    }
  }

  updateCharacteristics(): void {

    this.service.updateCharacteristic(this.Characteristic.StatusFault,
      this.waterHeater.hasAlert ? this.Characteristic.StatusFault.GENERAL_FAULT : this.Characteristic.StatusFault.NO_FAULT);

    this.service.updateCharacteristic(this.Characteristic.Active, this.waterHeater.isEnabled ? 1 : 0);

    this.service.updateCharacteristic(this.Characteristic.CurrentHeaterCoolerState,
      this.waterHeater.isRunning ? this.Characteristic.CurrentHeaterCoolerState.HEATING :
        this.Characteristic.CurrentHeaterCoolerState.IDLE);

    this.service.updateCharacteristic(this.Characteristic.TargetHeaterCoolerState,
      this.Characteristic.TargetHeaterCoolerState.HEAT);
  
    this.service.updateCharacteristic(this.Characteristic.CurrentTemperature,
      toCelsius(this.waterHeater.currentTemp(this.inputTemperature), this.waterHeater.units));

    this.service.updateCharacteristic(this.Characteristic.HeatingThresholdTemperature,
      toCelsius(this.waterHeater.setPoint, this.waterHeater.units));
  }

  async getStatusFault(): Promise<CharacteristicValue> {
    return this.waterHeater.hasAlert ? this.Characteristic.StatusFault.GENERAL_FAULT : this.Characteristic.StatusFault.NO_FAULT;
  }
  
  async getActive(): Promise<CharacteristicValue> {
    return this.waterHeater.isEnabled ? 1 : 0;
  }

  async getCurrentState(): Promise<CharacteristicValue> {
    return this.waterHeater.isRunning ?
      this.Characteristic.CurrentHeaterCoolerState.HEATING :
      this.Characteristic.CurrentHeaterCoolerState.IDLE;
  }

  async getTargetState(): Promise<CharacteristicValue> {
    return this.Characteristic.TargetHeaterCoolerState.HEAT;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setTargetState(value: CharacteristicValue): Promise<void> {
    // Always HEAT, no-op for other states
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    return toCelsius(this.waterHeater.currentTemp(this.inputTemperature), this.waterHeater.units);
  }

  async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
    return toCelsius(this.waterHeater.setPoint, this.waterHeater.units);
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    const setPointC = value as number;
    const setPointNative = fromCelsius(setPointC, this.waterHeater.units);
    this.waterHeater.setSetPoint(setPointNative);
  }

  async setActive(value: CharacteristicValue): Promise<void> {
    const enabled = value as number === 1;
    this.waterHeater.setEnabled(enabled);
  }
}