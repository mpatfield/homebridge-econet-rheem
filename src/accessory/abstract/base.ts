import { Characteristic, CharacteristicSetHandler, CharacteristicValue, Nullable, PlatformAccessory, PrimitiveTypes, Service } from 'homebridge';

import { EveCharacteristic, isEveCharacteristic } from '../characteristic/eve.js';

import { strings } from '../../i18n/i18n.js';

import { AuthType } from '../../model/auth.js';
import { AccessoryType, CharacteristicKey, HKCharacteristicKey, MQTTKey, MQTTKeys } from '../../model/enums.js';
import { HistoryEntry, HistoryType } from '../../model/history.js';
import { MQTT, MQTTDependency, MQTTListener } from '../../model/mqtt.js';
import { CharacteristicType, AccessoryDependency, EquipmentData } from '../../model/types.js';

import { debounce } from '../../tools/debounce.js';
import { Log, LogType } from '../../tools/log.js';
import { Properties } from '../../tools/properties.js';
import getVersion from '../../tools/version.js';

export type OnUpdateHandler = (value: PrimitiveTypes) => (Promise<void>);

type ValueOrObject<T> = T | { value: T };

export type NumberCallback = (value: number) => void;

export abstract class BaseAccessory implements MQTTListener {

  public readonly name: string;

  private readonly mqttClient: MQTT | undefined;

  private readonly accessoryService: Service;

  private readonly updateHandlers = new Map<string, OnUpdateHandler[]>();

  constructor(
    private readonly dependency: AccessoryDependency,
    private readonly data: EquipmentData,
  ) {

    this.name = this.getValue(data['@NAME']) ?? data.device_type;
    this.platformAccessory.getService(dependency.Service.AccessoryInformation)!
      .setCharacteristic(dependency.Characteristic.Name, this.name)
      .setCharacteristic(dependency.Characteristic.ConfiguredName, this.name)
      .setCharacteristic(dependency.Characteristic.Manufacturer, strings.general.brand)
      .setCharacteristic(dependency.Characteristic.Model, data.device_type)
      .setCharacteristic(dependency.Characteristic.SerialNumber, data.serial_number)
      .setCharacteristic(dependency.Characteristic.FirmwareRevision, getVersion());

    const mqttDependency: MQTTDependency = {
      log: dependency.log,
      parentName: this.name,
      email: dependency.email,
      auth: dependency.auth,
      serialNumber: data.serial_number,
      macAddress: data.mac_address,
    };

    this.mqttClient = MQTT.connect(mqttDependency, this, dependency.debugMQTT);

    const serviceInstance = dependency.Service[this.getAccessoryType()];

    this.accessoryService = dependency.platformAccessory.getService(serviceInstance) || dependency.platformAccessory.addService(serviceInstance);
  }

  public get Characteristic(): CharacteristicType {
    return this.dependency.Characteristic;
  }

  public get platformAccessory(): PlatformAccessory {
    return this.dependency.platformAccessory;
  }

  public get log(): Log {
    return this.dependency.log;
  }

  protected abstract getAccessoryType(): AccessoryType;

  public get service(): Service {
    return this.accessoryService;
  }

  public get identifier(): string {
    return this.data.serial_number;
  }

  private get disableLogging(): boolean {
    return this.dependency.disableLogging;
  }

  protected get isDeviceAuth(): boolean {
    return this.dependency.auth.type === AuthType.DEVICE;
  }

  private getMQTTKey(mqttKeys: MQTTKeys): MQTTKey {

    if (this.isDeviceAuth) {
      return mqttKeys.device;
    }

    return mqttKeys.user;      
  }

  public mqttMessageReceived(message: Record<string, ValueOrObject<PrimitiveTypes>>): void {    

    if (!this.isDeviceAuth && message.serial_number !== this.identifier) {
      return;
    }

    for (const key of Object.keys(message)) {
      const value = this.getValue(message[key]);
      this.updateHandlers.get(key)?.forEach(handler => {
        handler(value);
      });
    }
  }

  private publish(mqttKey: MQTTKey, value: PrimitiveTypes) {

    const payload: Record<string, PrimitiveTypes> = {};
    payload[mqttKey] = value;

    this.publishPayload(payload);
  }

  protected publishPayload(payload: Record<string, PrimitiveTypes>) {

    if (!this.isDeviceAuth) {
      payload.serial_number = this.data.serial_number;
      payload.device_name = this.data.device_name;
    }

    this.mqttClient?.publish(payload);
  }

  public teardown() {
    this.mqttClient?.teardown();
  }

  protected setCharacteristicValue(key: HKCharacteristicKey, value: CharacteristicValue): Characteristic {
    return this.accessoryService.getCharacteristic(this.Characteristic[key]).onGet( () => {
      return value;
    })?.setValue(value);
  }

  public getProperty(key: CharacteristicKey): CharacteristicValue | undefined {
    return Properties.get(this.identifier, key);
  }

  public setProperty(key: CharacteristicKey, value: CharacteristicValue) {
    Properties.set(this.identifier, key, value);
  }

  protected getValue<T>(input: ValueOrObject<T>): T {
    return typeof input === 'object' && input !== null && 'value' in input ? input.value : (input as T);
  }

  protected setup(
    characteristicKey: CharacteristicKey,
    initialValue: CharacteristicValue,
    mqttKeys: MQTTKeys,
    onUpdateHandler: OnUpdateHandler,
    onSetHandler?: CharacteristicSetHandler,
  ): Characteristic {

    const characteristic = this.setupGet(characteristicKey, initialValue, mqttKeys, onUpdateHandler);

    if (onSetHandler !== undefined) {
      this.setupSet(characteristicKey, onSetHandler);
    }

    return characteristic;
  }

  private setupGet(
    characteristicKey: CharacteristicKey,
    defaultValue: CharacteristicValue,
    mqttKeys: MQTTKeys,
    onUpdateHandler: OnUpdateHandler,
  ): Characteristic {

    const startingValue = this.getProperty(characteristicKey) ?? defaultValue;

    if (this.isOptionalCharacteristic(characteristicKey)) {
      this.service.addOptionalCharacteristic(this.characteristicFromKey(characteristicKey));
    }

    const characteristic = this.service.getCharacteristic(this.characteristicFromKey(characteristicKey));
    characteristic.setValue(startingValue);

    this.setProperty(characteristicKey, startingValue);

    characteristic.onGet( async (): Promise<Nullable<CharacteristicValue>> => {
      return this.getProperty(characteristicKey) ?? null;
    });
    
    const mqttKey = this.getMQTTKey(mqttKeys);

    const handlers = this.updateHandlers.get(mqttKey) ?? [];
    handlers.push(onUpdateHandler);
    this.updateHandlers.set(mqttKey, handlers);

    return characteristic;
  }

  private setupSet(characteristicKey: CharacteristicKey, onSetHandler: CharacteristicSetHandler) {

    if (this.isOptionalCharacteristic(characteristicKey)) {
      this.service.addOptionalCharacteristic(this.characteristicFromKey(characteristicKey));
    }

    const characteristic = this.service.getCharacteristic(this.characteristicFromKey(characteristicKey));
    characteristic.onSet(onSetHandler);
  }

  protected bindOnUpdateNumericBoolean(charKey: CharacteristicKey, logTrue: string, logFalse: string): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {
      if (typeof value !== 'number') {
        this.log.error(strings.accessory.badValue, this.name, 'number', charKey, `${value.toString()}`);
        return;
      }
      this.onUpdate(charKey, value, value === 1 ? logTrue : logFalse);
    }).bind(this);
  }

  protected bindOnUpdateNumeric(charKey: CharacteristicKey, logTemplate: string, callback?: NumberCallback): OnUpdateHandler {
    return (async (value: PrimitiveTypes) => {

      if (typeof value !== 'number') {
        this.log.error(strings.accessory.badValue, this.name, 'number', charKey, `'${value.toString()}'`);
        return;
      }

      const characteristic = this.service.getCharacteristic(this.characteristicFromKey(charKey));
      const minValue = characteristic.props.minValue;
      const maxValue = characteristic.props.maxValue;
      if (minValue !== undefined && value < minValue) {
        this.logIfDesired(LogType.WARNING, strings.accessory.outOfRange, charKey, `'${value.toString()}'`, `'${minValue.toString()}'`);
        value = minValue;
      } else if (maxValue !== undefined && value > maxValue) {
        this.logIfDesired(LogType.WARNING, strings.accessory.outOfRange, charKey, `'${value.toString()}'`, `'${maxValue.toString()}'`);
        value = maxValue;
      }

      const logString = logTemplate.replace('%d', value.toString());
      this.onUpdate(charKey, value, logString);

      callback?.(value);

    }).bind(this);
  }

  protected bindOnSetNumericBoolean(charKey: CharacteristicKey, mqttKeys: MQTTKeys, logTrue: string, logFalse: string, debounce: boolean = false):
  CharacteristicSetHandler {
    return (async (value: CharacteristicValue) => {
      const logTemplate = value === 1 ? logTrue : logFalse;
      this.onSetNumeric(charKey, mqttKeys, value, value as number, logTemplate, debounce);
    }).bind(this);
  }

  protected bindOnSetNumeric(charKey: CharacteristicKey, mqttKeys: MQTTKeys, logTemplate: string, debounce: boolean = false): CharacteristicSetHandler {
    return (async (value: CharacteristicValue) => {
      this.onSetNumeric(charKey, mqttKeys, value, value as number, logTemplate, debounce);
    }).bind(this);
  }

  protected onUpdate(key: CharacteristicKey, value: CharacteristicValue, logString: string | undefined = undefined): boolean {

    if (value === this.getProperty(key)) {
      return false;
    }

    this.setProperty(key, value);

    this.service.updateCharacteristic(this.characteristicFromKey(key), value);

    if (logString) {
      this.logIfDesired(logString);
    }

    return true;
  }

  protected onSet(charKey: CharacteristicKey, mqttKeys: MQTTKeys, value: CharacteristicValue, publish: PrimitiveTypes, logString: string | undefined) {

    if (logString && value !== this.getProperty(charKey)) {
      this.logIfDesired(logString);
    }

    this.setProperty(charKey, value);

    this.service.updateCharacteristic(this.characteristicFromKey(charKey), value);

    const mqttKey = this.getMQTTKey(mqttKeys);
    this.publish(mqttKey, publish);
  }

  protected onSetNumeric(charKey: CharacteristicKey, mqttKeys: MQTTKeys, value: CharacteristicValue,
    publish: number, logTemplate: string, doDebounce: boolean) {

    if (typeof value !== 'number') {
      this.log.error(strings.accessory.badValue, this.name, 'number', charKey, `'${value}'`);
      return;
    }

    const task = () => {
      const logString = logTemplate.replace('%d', publish.toString());
      this.onSet(charKey, mqttKeys, value, publish, logString);
    };

    if (doDebounce) {
      debounce(`${this.identifier}_${charKey}`, task);
    } else {
      task();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected characteristicFromKey(key: CharacteristicKey): any {

    if (isEveCharacteristic(key)) {
      return EveCharacteristic(key);
    }

    return this.Characteristic[key];
  }

  private isOptionalCharacteristic(key: CharacteristicKey): boolean {
    return key === HKCharacteristicKey.StatusFault || isEveCharacteristic(key);
  }

  protected recordHistory(type: HistoryType, entry: HistoryEntry, updateLastActivation: boolean = true): boolean {
    return this.dependency.history.record(this, type, entry, updateLastActivation);
  }

  protected logIfDesired(message: string, ...parameters: string[]): void;
  protected logIfDesired(level: LogType, message: string, ...parameters: string[]): void;
  protected logIfDesired(levelOrMessage: LogType | string, ...rest: string[]) {

    if (this.disableLogging) {
      return;
    }

    if (typeof levelOrMessage === 'string') {
      this.log.always(levelOrMessage, this.name, ...rest);
      return;
    }

    const [message, ...parameters] = rest;
    switch(levelOrMessage) {
    case LogType.WARNING:
      this.log.warning(message, this.name, ...parameters);
      break;
    case LogType.ERROR:
      this.log.error(message, this.name, ...parameters);
      break;
    default:
      this.log.always(message, this.name, ...parameters);
      break;
    }
  }
}