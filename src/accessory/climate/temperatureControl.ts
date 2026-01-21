import { CharacteristicSetHandler, CharacteristicValue, PrimitiveTypes } from 'homebridge';

import { BaseAccessory, NumberCallback, OnUpdateHandler } from '../abstract/base.js';

import { strings } from '../../i18n/i18n.js';

import { CharacteristicKey, HKCharacteristicKey, MQTTKey, MQTTKeys } from '../../model/enums.js';
import { HistoryType } from '../../model/history.js';
import { AccessoryDependency, EquipmentData, Setpoint } from '../../model/types.js';

import { fromCelsius, TemperatureUnits, toCelsius } from '../../tools/temperature.js';

type TemperatureDefaults = { setPoint: number, lowerLimit: number, upperLimit: number }

export function TemperatureDefaults(setPoint: number, lowerLimit: number, upperLimit: number) {
  return { setPoint, lowerLimit, upperLimit };
}

export type Thresholds = { minimum: number, maximum: number }

export abstract class TemperatureControlAccessory extends BaseAccessory {

  protected readonly units: TemperatureUnits; 

  constructor(dependency: AccessoryDependency, data: EquipmentData, private readonly defaults: TemperatureDefaults) {
    super(dependency, data);

    this.units = data['@SETPOINT']?.constraints?.units?.includes('F') ? TemperatureUnits.FAHRENHEIT : TemperatureUnits.CELSIUS;

    const temperatureDisplayUnits = this.units === TemperatureUnits.FAHRENHEIT ?
      dependency.Characteristic.TemperatureDisplayUnits.FAHRENHEIT : dependency.Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.setCharacteristicValue(HKCharacteristicKey.TemperatureDisplayUnits, temperatureDisplayUnits);

    const setPoint = data['@SETPOINT']?.value ? toCelsius(data['@SETPOINT']?.value, this.units) : defaults.setPoint;
    this.setup(HKCharacteristicKey.CurrentTemperature, setPoint, MQTTKeys(MQTTKey.CURRENT_TEMP, MQTTKey.SETPOINT_U),
      this.bindOnUpdateTemperature(HKCharacteristicKey.CurrentTemperature, this.units, strings.temperatureControl.current, (value) => {
        this.recordHistory(HistoryType.WEATHER, { temp: value } );
      }),
    );

    const hasAlert = typeof data['@ALERTCOUNT'] === 'number' && data['@ALERTCOUNT'] > 0;
    const faultStatus = hasAlert ? this.Characteristic.StatusFault.GENERAL_FAULT : this.Characteristic.StatusFault.NO_FAULT;
    this.setup(HKCharacteristicKey.StatusFault, faultStatus, MQTTKeys(MQTTKey.ALERT_COUNT_D, MQTTKey.ALERT_COUNT_U),
      this.bindOnAlertCountUpdate(),
    );
  }

  protected setupThreshold(charKey: HKCharacteristicKey, setPoint: Setpoint | undefined, mqttKeys: MQTTKeys): Thresholds {

    const setpointValue = setPoint?.value ? toCelsius(setPoint?.value, this.units) : this.defaults.setPoint;

    const minimum = setPoint?.constraints?.lowerLimit ? toCelsius(setPoint?.constraints.lowerLimit, this.units) : this.defaults.lowerLimit;
    const maximum = setPoint?.constraints?.upperLimit ? toCelsius(setPoint?.constraints.upperLimit, this.units) : this.defaults.upperLimit;
    this.service.getCharacteristic(this.characteristicFromKey(charKey))
      .setProps({ maxValue: maximum, minStep: 0.1 })
      .setValue(setpointValue)
      .setProps({ minValue: minimum });

    this.setup(charKey, setpointValue, mqttKeys,
      this.bindOnUpdateTemperature(charKey, this.units, strings.temperatureControl.target),
      this.bindOnSetTemperature(charKey, this.units, mqttKeys, strings.temperatureControl.targetSet, true));

    return { minimum, maximum };
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

  protected bindOnUpdateTemperature(charKey: CharacteristicKey, units: TemperatureUnits, logTemplate: string, callback?: NumberCallback): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {

      if (typeof value !== 'number') {
        this.log.error(strings.accessory.badValue, this.name, 'number', charKey, `'${value}'`);
        return;
      }
    
      const temperature = toCelsius(value, units);
    
      const logString = logTemplate.replace('%d°%s', `${value}°${units}`);
      this.onUpdate(charKey, temperature, logString);
  
      callback?.(temperature);

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