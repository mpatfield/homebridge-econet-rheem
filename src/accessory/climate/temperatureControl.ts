import { CharacteristicSetHandler, CharacteristicValue, PrimitiveTypes } from 'homebridge';

import { BaseAccessory, OnUpdateHandler } from '../abstract/base.js';

import { strings } from '../../i18n/i18n.js';

import { CharacteristicKey, HKCharacteristicKey, MQTTKey, MQTTKeys } from '../../model/enums.js';
import { AccessoryDependency, EquipmentData } from '../../model/types.js';

import { fromCelsius, TemperatureUnits, toCelsius } from '../../tools/temperature.js';

export abstract class TemperatureControlAccessory extends BaseAccessory {

  protected readonly units: TemperatureUnits; 

  constructor(dependency: AccessoryDependency, data: EquipmentData) {
    super(dependency, data);

    this.units = data['@SETPOINT']?.constraints?.units?.includes('F') ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS;

    const temperatureDisplayUnits = this.units === TemperatureUnits.FAHRENHEIT ?
      dependency.Characteristic.TemperatureDisplayUnits.FAHRENHEIT : dependency.Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.setCharacteristicValue(HKCharacteristicKey.TemperatureDisplayUnits, temperatureDisplayUnits);

    const hasAlert = typeof data['@ALERTCOUNT'] === 'number' && data['@ALERTCOUNT'] > 0;
    const faultStatus = hasAlert ? this.Characteristic.StatusFault.GENERAL_FAULT : this.Characteristic.StatusFault.NO_FAULT;
    this.setup(HKCharacteristicKey.StatusFault, faultStatus, MQTTKeys(MQTTKey.ALERT_COUNT_D, MQTTKey.ALERT_COUNT_U),
      this.bindOnAlertCountUpdate(),
    );
  }

  private bindOnAlertCountUpdate(): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {

      let hasAlert: boolean = false;
      if (this.isDeviceAuth) {
        this.log.warning(`${this.bindOnAlertCountUpdate.name} is currently unsupported using DeviceAuth. Please create a ticket mentioning this warning.`);
        return;
      } else {

        if (typeof value !== 'number') {
          this.log.error(strings.accessory.badValue, this.name, 'string', HKCharacteristicKey.StatusFault, `${JSON.stringify(value)}`);
          return;
        }

        hasAlert = value > 0;
      }

      const faultStatus = hasAlert ? this.Characteristic.StatusFault.GENERAL_FAULT : this.Characteristic.StatusFault.NO_FAULT;

      if (this.onUpdate(HKCharacteristicKey.StatusFault, faultStatus) && hasAlert) {
        this.log.warning(strings.accessory.alert);
      }

    }).bind(this);
  }

  protected onUpdateTemperature(charKey: CharacteristicKey, value: PrimitiveTypes, units: TemperatureUnits, logTemplate: string): number | undefined {
  
    if (typeof value !== 'number') {
      this.log.error(strings.accessory.badValue, this.name, 'number', charKey, `'${value}'`);
      return;
    }
    
    const temperature = toCelsius(value, units);
    
    const logString = logTemplate.replace('%d°%s', `${value}°${units}`);
    this.onUpdate(charKey, temperature, logString);
  
    return temperature;
  }
  
  protected bindOnUpdateTemperature(charKey: CharacteristicKey, units: TemperatureUnits, logTemplate: string): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {
      this.onUpdateTemperature(charKey, value, units, logTemplate);
    }).bind(this);
  }

  protected bindOnSetTemperature(charKey: CharacteristicKey, units: TemperatureUnits, mqttKeys: MQTTKeys, logTemplate: string, debounce: boolean = false):
    CharacteristicSetHandler {
    return (async (value: CharacteristicValue) => {
  
      if (typeof value !== 'number') {
        this.log.error(strings.accessory.badValue, this.name, 'number', charKey, `'${value}'`);
        return;
      }
  
      logTemplate = logTemplate.replace('%d°%s', `%d°${units}`);
      const publish = fromCelsius(value, units);
  
      this.onSetNumeric(charKey, mqttKeys, value, publish, logTemplate, debounce);
  
    }).bind(this);
  }
}