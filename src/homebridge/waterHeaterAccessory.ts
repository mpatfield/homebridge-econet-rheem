import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { EconetRheemPlatform } from '../homebridge/platform.js';

import { strings } from '../i18n/i18n.js';

import { TemperatureUnits } from '../model/constants.js';
import { WaterHeater } from '../model/waterHeater.js';

import { toCelsius, fromCelsius } from '../tools/temperature.js';
import getVersion from '../tools/version.js';

export class WaterHeaterAccessory {
  private service: Service;
  private readonly Characteristic: typeof import('homebridge').Characteristic;

  constructor(
    platform: EconetRheemPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly waterHeater: WaterHeater,
    private readonly alwaysUseCurrentTemp: boolean,
  ) {
    
    this.Characteristic = platform.api.hap.Characteristic;
    const Service = platform.api.hap.Service;

    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, strings.general.brand)
      .setCharacteristic(this.Characteristic.Model, strings.equipment.waterHeater)
      .setCharacteristic(this.Characteristic.SerialNumber, this.waterHeater.serialNumber)
      .setCharacteristic(this.Characteristic.FirmwareRevision, getVersion());

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
      .setValue(this.Characteristic.TargetHeaterCoolerState.HEAT)
      .setProps({ validValues: [this.Characteristic.TargetHeaterCoolerState.HEAT] })
      .onGet(this.getTargetState.bind(this))
      .onSet(this.setTargetState.bind(this));

    this.service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    const minTemp = toCelsius(this.waterHeater.limits[0], this.waterHeater.units);
    const maxTemp = toCelsius(this.waterHeater.limits[1], this.waterHeater.units);
    const setpoint = toCelsius(this.waterHeater.setPoint, this.waterHeater.units);
    this.service.getCharacteristic(this.Characteristic.HeatingThresholdTemperature)
      .setProps({ maxValue: maxTemp, minStep: 0.1 })
      .setValue(setpoint)
      .setProps({ minValue: minTemp })
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    this.waterHeater.setOnUpdateCallback(this.handleEquipmentUpdate.bind(this));

    this.updateCharacteristics();
  }

  private handleEquipmentUpdate(serial: string): void {
    if (serial === this.waterHeater.serialNumber) {
      this.updateCharacteristics();
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

  private get inputTemperature() : number | null {

    if (this.alwaysUseCurrentTemp) {
      return null;
    }

    const month = new Date().getMonth();
  
    // Coldest: Jan, Feb, Dec
    if (month === 0 || month === 1 || month === 11) {
      return this.waterHeater.units === TemperatureUnits.FAHRENHEIT ? 50 : 10;
    }

    // Hottest: Jun, Jul, Aug
    if (month === 5 || month === 6 || month === 7) {
      return this.waterHeater.units === TemperatureUnits.FAHRENHEIT ? 70 : 20;
    }

    // All other months
    return this.waterHeater.units === TemperatureUnits.FAHRENHEIT ? 60 : 15;
  }
}