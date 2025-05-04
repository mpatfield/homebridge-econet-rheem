import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { EconetRheemPlatform } from '../platform.js';
import { Thermostat } from '../model/thermostat.js';
import { TemperatureUnits, ThermostatOperationMode } from '../model/enums.js';

import { toCelsius, fromCelsius } from '../model/utils.js';

export class ThermostatAccessory {
  private service: Service;
  private readonly Characteristic: typeof import('homebridge').Characteristic;

  constructor(
    private readonly platform: EconetRheemPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly thermostat: Thermostat,
  ) {

    this.Characteristic = platform.api.hap.Characteristic;
    const Service = platform.api.hap.Service;

    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'Rheem')
      .setCharacteristic(this.Characteristic.Model, 'Thermostat')
      .setCharacteristic(this.Characteristic.SerialNumber, this.thermostat.serialNumber);

    this.service = this.accessory.getService(Service.Thermostat) ||
      this.accessory.addService(Service.Thermostat);

    this.service.setCharacteristic(this.Characteristic.Name, this.thermostat.deviceName);

    this.service.getCharacteristic(this.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    this.service.getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
      .onGet(this.getUnits.bind(this));

    this.service.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentState.bind(this));

    this.service.getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .setProps({ validValues:[
        this.Characteristic.TargetHeatingCoolingState.OFF,
        this.Characteristic.TargetHeatingCoolingState.HEAT,
        this.Characteristic.TargetHeatingCoolingState.COOL,
        this.Characteristic.TargetHeatingCoolingState.AUTO,
      ] })
      .onGet(this.getTargetState.bind(this))
      .onSet(this.setTargetState.bind(this));

    this.service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(this.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    const minHeatTemp = toCelsius(this.thermostat.heatSetPointLimits[0], this.thermostat.units);
    const maxHeatTemp = toCelsius(this.thermostat.heatSetPointLimits[1], this.thermostat.units);
    this.service.getCharacteristic(this.Characteristic.HeatingThresholdTemperature)
      .setProps({ minValue: minHeatTemp, maxValue: maxHeatTemp, minStep: 0.1 })
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    const minCoolTemp = toCelsius(this.thermostat.coolSetPointLimits[0], this.thermostat.units);
    const maxCoolTemp = toCelsius(this.thermostat.coolSetPointLimits[1], this.thermostat.units);
    this.service.getCharacteristic(this.Characteristic.CoolingThresholdTemperature)
      .setProps({ minValue: minCoolTemp, maxValue: maxCoolTemp, minStep: 0.1 })
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    this.thermostat.setOnUpdateCallback(this.handleEquipmentUpdate.bind(this));

    this.updateCharacteristics();
  }

  private handleEquipmentUpdate(serial: string): void {
    if (serial === this.thermostat.serialNumber) {
      this.updateCharacteristics();
      this.platform.log.debug(`Received update for ${serial}, refreshed accessory state`);
    }
  }

  private updateCharacteristics(): void {
    this.service.updateCharacteristic(this.Characteristic.Active, this.thermostat.isEnabled ? 1 : 0);

    this.service.updateCharacteristic(this.Characteristic.CurrentHeaterCoolerState, this.getCurrentRunningState());

    this.service.updateCharacteristic(this.Characteristic.CurrentHeatingCoolingState, this.getCurrentState());
    this.service.updateCharacteristic(this.Characteristic.TargetHeatingCoolingState, this.getTargetState());
  
    this.service.updateCharacteristic(this.Characteristic.CurrentTemperature,
      toCelsius(this.thermostat.currentTemp, this.thermostat.units));

    this.service.updateCharacteristic(this.Characteristic.TargetTemperature, this.getTargetTemperature());

    this.service.updateCharacteristic(this.Characteristic.HeatingThresholdTemperature, this.getHeatingThresholdTemperature());
    this.service.updateCharacteristic(this.Characteristic.CoolingThresholdTemperature, this.getCoolingThresholdTemperature());
  }

  async getActive(): Promise<CharacteristicValue> {
    return this.thermostat.isEnabled ? 1 : 0;
  }

  async setActive(value: CharacteristicValue): Promise<void> {
    const enabled = value as number === 1;
    await this.thermostat.setEnabled(enabled);
  }

  private getUnits(): number {
    return this.thermostat.units === TemperatureUnits.FAHRENHEIT ? 1 : 0;
  }

  private getCurrentRunningState(): number {

    const currentState = this.getCurrentRunningState();

    if (!this.thermostat.isRunning || currentState === this.Characteristic.CurrentHeatingCoolingState.OFF) {
      return this.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    if (currentState === this.Characteristic.CurrentHeatingCoolingState.HEAT) {
      return this.Characteristic.CurrentHeaterCoolerState.HEATING;
    }

    return this.Characteristic.CurrentHeaterCoolerState.COOLING;
  }

  private getCurrentState(): number {
    if (!this.thermostat.isEnabled) {
      return this.Characteristic.CurrentHeatingCoolingState.OFF;
    }
    switch (this.thermostat.mode) {
    case ThermostatOperationMode.HEATING:
    case ThermostatOperationMode.EMERGENCY_HEAT:
      return this.Characteristic.CurrentHeatingCoolingState.HEAT;
    case ThermostatOperationMode.COOLING:
      return this.Characteristic.CurrentHeatingCoolingState.COOL;
    default:
      return this.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }

  private getTargetState(): number {
    switch (this.thermostat.mode) {
    case ThermostatOperationMode.OFF:
      return this.Characteristic.TargetHeatingCoolingState.OFF;
    case ThermostatOperationMode.HEATING:
    case ThermostatOperationMode.EMERGENCY_HEAT:
      return this.Characteristic.TargetHeatingCoolingState.HEAT;
    case ThermostatOperationMode.COOLING:
      return this.Characteristic.TargetHeatingCoolingState.COOL;
    case ThermostatOperationMode.AUTO:
      return this.Characteristic.TargetHeatingCoolingState.AUTO;
    default:
      return this.Characteristic.TargetHeatingCoolingState.OFF;
    }
  }

  private async setTargetState(value: CharacteristicValue): Promise<void> {
    const state = value as number;
    let mode: ThermostatOperationMode;
    switch (state) {
    case this.Characteristic.TargetHeatingCoolingState.OFF:
      mode = ThermostatOperationMode.OFF;
      break;
    case this.Characteristic.TargetHeatingCoolingState.HEAT:
      mode = ThermostatOperationMode.HEATING;
      break;
    case this.Characteristic.TargetHeatingCoolingState.COOL:
      mode = ThermostatOperationMode.COOLING;
      break;
    case this.Characteristic.TargetHeatingCoolingState.AUTO:
      mode = ThermostatOperationMode.AUTO;
      break;
    default:
      this.platform.log.error('Unsupported target state:', state);
      return;
    }
    this.thermostat.setMode(mode);
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    return toCelsius(this.thermostat.currentTemp, this.thermostat.units);
  }

  private getTargetTemperature(): number {
    const heatSetPoint = toCelsius(this.thermostat.heatSetPoint, this.thermostat.units);
    const coolSetPoint = toCelsius(this.thermostat.coolSetPoint, this.thermostat.units);
    switch (this.thermostat.mode) {
    case ThermostatOperationMode.HEATING:
    case ThermostatOperationMode.EMERGENCY_HEAT:
      return heatSetPoint;
    case ThermostatOperationMode.COOLING:
      return coolSetPoint;
    default: {
      return (heatSetPoint + coolSetPoint) / 2;
    }
    }
  }

  private async setTargetTemperature(value: CharacteristicValue): Promise<void> {
    const temp = fromCelsius(value as number, this.thermostat.units);
    switch (this.thermostat.mode) {
    case ThermostatOperationMode.HEATING:
    case ThermostatOperationMode.EMERGENCY_HEAT:
      this.thermostat.setSetPoint(undefined, undefined, temp);
      break;
    case ThermostatOperationMode.COOLING:
      this.thermostat.setSetPoint(undefined, temp);
      break;
    case ThermostatOperationMode.AUTO: {
      const deadband = this.thermostat.deadband;
      const heatSetPoint = temp - deadband / 2;
      const coolSetPoint = temp + deadband / 2;
      this.thermostat.setSetPoint(undefined, coolSetPoint, heatSetPoint);
      break;
    }
    }
  }

  private getHeatingThresholdTemperature(): number {
    return toCelsius(this.thermostat.heatSetPoint, this.thermostat.units);
  }

  private async setHeatingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    const temp = fromCelsius(value as number, this.thermostat.units);
    this.thermostat.setSetPoint(undefined, undefined, temp);
  }

  private getCoolingThresholdTemperature(): number {
    return toCelsius(this.thermostat.coolSetPoint, this.thermostat.units);
  }

  private async setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void> {
    const temp = fromCelsius(value as number, this.thermostat.units);
    this.thermostat.setSetPoint(undefined, temp);
  }
}