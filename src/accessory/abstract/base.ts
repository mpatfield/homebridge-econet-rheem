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

type OnUpdateHandler = (valueOrObject: ValueOrObject<unknown>) => (Promise<void>);

type ValueOrObject<T> = T | { value: T };

export abstract class BaseAccessory implements MQTTListener {

  public readonly name: string;

  private readonly mqttClient: MQTT | undefined;

  private readonly accessoryService: Service;

  private readonly updateHandlers = new Map<string, OnUpdateHandler>();

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
      caller: this.name,
      email: dependency.email,
      auth: dependency.auth,
      serialNumber: data.serial_number,
      macAddress: data.mac_address ?? 'unknown',
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

  private getMQTTKey(mqttKeys: MQTTKeys): MQTTKey {

    if (typeof mqttKeys === 'string') {
      return mqttKeys;
    }
    
    if (this.dependency.auth.type === AuthType.DEVICE) {
      return mqttKeys.device;
    }

    return mqttKeys.user;      
  }

  public mqttMessageReceived(message: Record<string, unknown>): void {    

    // TODO does this work for device messages also?
    if (message.serial_number !== this.identifier) {
      return;
    }

    for (const key of Object.keys(message)) {
      this.updateHandlers.get(key)?.(message[key]);
    }
  }

  private publish(mqttKey: MQTTKey, value: PrimitiveTypes) {

    const payload: Record<string, PrimitiveTypes> = {};
    payload[mqttKey] = value;

    if (this.dependency.auth.type === AuthType.USER) {
      payload.serial_number = this.data.serial_number;
      payload.device_name = this.data.device_name;
    }

    this.mqttClient?.publish(payload);
  }

  public teardown() {
    this.mqttClient?.teardown();
  }

  protected setCharacteristicValue(key: HKCharacteristicKey, value: CharacteristicValue) {
    this.accessoryService.getCharacteristic(this.Characteristic[key]).onGet( () => {
      return value;
    });
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
  ): Characteristic | undefined {

    const characteristic = this.setupGet(characteristicKey, initialValue, mqttKeys, onUpdateHandler);
    if (!characteristic) {
      return;
    }

    if (onSetHandler !== undefined) {
      this.setupSet(characteristicKey, onSetHandler);
    }

    return characteristic;
  }

  private setupGet(
    characteristicKey: CharacteristicKey,
    initialValue: CharacteristicValue,
    mqttKeys: MQTTKeys,
    onUpdateHandler: OnUpdateHandler,
  ): Characteristic {

    if (isEveCharacteristic(characteristicKey)) {
      this.service.addOptionalCharacteristic(this.characteristicFromKey(characteristicKey));
    }

    const characteristic = this.service.getCharacteristic(this.characteristicFromKey(characteristicKey));
    characteristic.setValue(initialValue);

    this.setProperty(characteristicKey, initialValue);

    characteristic.onGet( async (): Promise<Nullable<CharacteristicValue>> => {
      return this.getProperty(characteristicKey) ?? null;
    });
    
    const mqttKey = this.getMQTTKey(mqttKeys);
    this.updateHandlers.set(mqttKey, onUpdateHandler);

    return characteristic;
  }

  private setupSet(characteristicKey: CharacteristicKey, onSetHandler: CharacteristicSetHandler) {

    if (isEveCharacteristic(characteristicKey)) {
      this.service.addOptionalCharacteristic(this.characteristicFromKey(characteristicKey));
    }

    const characteristic = this.service.getCharacteristic(this.characteristicFromKey(characteristicKey));
    characteristic.onSet(onSetHandler);
  }

  protected bindOnUpdateNumericBoolean(charKey: CharacteristicKey, logTrue: string, logFalse: string): OnUpdateHandler {
    return (async (valueOrObject: ValueOrObject<unknown>) => {
      const value = this.getValue(valueOrObject);
      if (typeof value !== 'number') {
        this.log.error(strings.characteristic.badValue, this.name, charKey, `${JSON.stringify(valueOrObject)}`);
        return;
      }
      this.onUpdate(charKey, value, value === 1 ? logTrue : logFalse);
    }).bind(this);
  }

  protected bindOnSetNumericBoolean(key: CharacteristicKey, mqttKeys: MQTTKeys, logTrue: string, logFalse: string, debounce: boolean = false) {
    return (async (value: CharacteristicValue) => {
      const logTemplate = value === 1 ? logTrue : logFalse;
      this.onSetNumeric(key, mqttKeys, value, logTemplate, debounce);
    }).bind(this);
  }

  protected bindOnSetNumeric(key: CharacteristicKey, mqttKeys: MQTTKeys, logTemplate: string, debounce: boolean = false) {
    return (async (value: CharacteristicValue) => {
      this.onSetNumeric(key, mqttKeys, value, logTemplate, debounce);
    }).bind(this);
  }

  private onUpdate(key: CharacteristicKey, value: CharacteristicValue, logString: string | undefined = undefined): boolean {

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

  private onSetNumeric(charKey: CharacteristicKey, mqttKeys: MQTTKeys, value: CharacteristicValue, logTemplate: string, shouldDebounce: boolean) {

    if (typeof value !== 'number') {
      this.log.error(strings.characteristic.badValue, this.name, charKey, `'${value}'`);
      return;
    }

    const task = () => {
      const logString = logTemplate.replace('%d', value.toString());
      this.onSet(charKey, mqttKeys, value, value, logString);
    };

    if (shouldDebounce) {
      debounce(`${this.identifier}_${charKey}`, task);
    } else {
      task();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private characteristicFromKey(key: CharacteristicKey): any {

    if (isEveCharacteristic(key)) {
      return EveCharacteristic(key);
    }

    return this.Characteristic[key];
  }

  protected recordHistory(type: HistoryType, entry: HistoryEntry, updateLastActivation: boolean = false): boolean {
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
