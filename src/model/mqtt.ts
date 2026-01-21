import { createHash } from 'crypto';
import { PrimitiveTypes } from 'homebridge';
import mqtt from 'mqtt';
import storage from 'node-persist';

import { AuthType, DeviceAuth, UserAuth } from './auth.js';
import { MQTTKey } from './enums.js';
import { EconetApi } from './http.js';

import { strings } from '../i18n/i18n.js';

import { CLEARBLADE_HOST, CLEARBLADE_KEY, PLATFORM_NAME } from '../homebridge/settings.js';

import { Log, LogType } from '../tools/log.js';
import { MINUTE, SECOND } from '../tools/time.js';

const BROKER_URL = `mqtts://${CLEARBLADE_HOST}:1884`;

const TOPIC_BASE_USER = 'user/%s/device/';
const TOPIC_BASE_DEVICE = 'device/%s/%s/4736/';

const KEEPALIVE = 90;

const DELAYS = [5 * SECOND, 10 * SECOND, 30 * SECOND, 2 * MINUTE, 5 * MINUTE];

const IDLE_CONNECTION_TIMER_INTERVAL = 16 * MINUTE;

export interface MQTTListener {
  mqttMessageReceived(message: Record<string, unknown>): void;
}

interface MQTTError extends Error {
  code?: string | number;
}

export type MQTTDependency = {
  log: Log,
  parentName: string,
  email: string,
  auth: DeviceAuth | UserAuth,
  serialNumber: string,
  macAddress: string,
  debug: boolean,
}

export class MQTT {

  private static readonly INSTANCES = new Map<string, MQTT>();

  static connect(dependency: MQTTDependency, listener: MQTTListener): MQTT | undefined {

    let username: string;
    let clientId: string | undefined;

    let topic: string;

    switch(dependency.auth.type) {
    case AuthType.DEVICE:
      username = dependency.auth.token;
      topic = TOPIC_BASE_DEVICE.replace('%s', dependency.macAddress).replace('%s', dependency.serialNumber);
      break;
    case AuthType.USER:
      username = dependency.auth.token;
      clientId = `${dependency.email}${Date.now().toString().replace('.', '').slice(0, 13)}_android`;
      topic = TOPIC_BASE_USER.replace('%s', (dependency.auth as UserAuth).accountId);
      break;
    }

    const options = {
      username,
      clientId,
      password: CLEARBLADE_KEY,
      rejectUnauthorized: true,
      keepalive: KEEPALIVE,
      reconnectPeriod: 0,
    };

    const seed = `${username}|${clientId ?? ''}}`;

    const id = createHash('sha256').update(seed).digest('hex').slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    const shortId = id.slice(0, 4);

    let instance = MQTT.INSTANCES.get(id);
    if (instance !== undefined) {
      dependency.log.ifDebug(strings.mqtt.reuse, dependency.parentName, shortId);

    } else {
      dependency.log.ifDebug(strings.mqtt.new, dependency.parentName, shortId);

      instance = new MQTT(dependency, options, topic);
      MQTT.INSTANCES.set(id, instance);

      instance.connect();
    }

    instance.listeners.push(listener);

    return instance;
  }

  private readonly log: Log;

  private client: mqtt.MqttClient | undefined = undefined;

  private idleTimer?: NodeJS.Timeout;

  private shouldReconnect = false;
  private isReconnecting = false;
  private reconnectCount = 0;

  private readonly listeners: MQTTListener[] = [];

  private readonly topicDesired: string;
  private readonly topicReported: string;

  private constructor(
    private readonly dependency: MQTTDependency,
    private readonly options: mqtt.IClientOptions,
    topicBase: string,
  ) {
    this.log = dependency.log;
    this.topicDesired = topicBase + 'desired';
    this.topicReported = topicBase + 'reported';
  }

  private connect(): void {

    this.shouldReconnect = true;

    this.client = mqtt.connect(BROKER_URL, this.options);

    this.client.on('connect', () => {
      this.log.ifDebug(strings.mqtt.connected, this.dependency.parentName);
      this.client?.subscribe(this.topicReported);
    });

    this.client.on('message', (topic, message) => this.messageReceived(topic, message.toString()));

    this.client.on('close', () => {
      this.log.ifDebug(strings.mqtt.disconnected, this.dependency.parentName);
      this.reconnect();
    });

    this.client.on('error', (error: MQTTError) => {
      this.log.warning(`${strings.mqtt.error}: ${error}`,  this.dependency.parentName);
    });
  }

  public teardown(): void {
    this.shouldReconnect = false;
    this.client?.end(true);
    this.client = undefined;
  }

  private messageReceived(topic: string, message: string) {

    this.log.ifDebug(`${this.dependency.parentName} ${this.messageReceived.name}() - ${topic}\n${message}`);

    this.reconnectCount = 0;
    this.resetIdleTimer();

    try {

      const parsed = JSON.parse(message);
      for (const listener of this.listeners) {
        listener.mqttMessageReceived(parsed);
      }

      if (this.dependency.debug) {
        this.saveData(parsed);
      }

    } catch (e) {
      this.log.error(strings.mqtt.parseFailed, this.dependency.parentName, `- ${topic}\n${message}`);
    }
  }

  public publish(payload: Record<string, PrimitiveTypes>): void {

    if (!this.client || !this.client.connected) {
      this.log.error(strings.mqtt.notConnected, this.dependency.parentName);
      return;
    }

    const dateTime = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const transactionId = `ANDROID_${dateTime}`;

    const data = {
      transactionId,
      ...payload,
    };

    const message = JSON.stringify(data);

    this.client.publish(this.topicDesired, message);
    this.log.ifDebug( `${this.dependency.parentName} ${this.publish.name}() — ${this.topicDesired} ${message}`);

    return;
  }

  private async reconnect() {

    if (!this.shouldReconnect || this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;

    if (this.client) {
      this.client.end(true);
      this.client = undefined;
    }

    this.reconnectCount++;
    if (this.reconnectCount % DELAYS.length === 0) {
      try {
        this.log.ifDebug(LogType.WARNING, strings.mqtt.unstable, this.dependency.parentName);
        await EconetApi.authenticateUser();
      } catch (error) {
        this.log.ifDebug(LogType.ERROR, strings.http.reauthFailed, this.dependency.parentName, JSON.stringify(error));
      }
    }

    const reconnectDelay = DELAYS[Math.min(this.reconnectCount, DELAYS.length - 1)];
    if (reconnectDelay < MINUTE) {
      this.log.ifDebug(strings.mqtt.reconnectSeconds, this.dependency.parentName, reconnectDelay / SECOND);
    } else {
      this.log.ifDebug(strings.mqtt.reconnectMinutes, this.dependency.parentName, reconnectDelay / MINUTE);
    }

    setTimeout(() => {
      this.isReconnecting = false;
      this.connect();
    }, reconnectDelay);
  }

  private resetIdleTimer() {

    clearTimeout(this.idleTimer);

    this.idleTimer = setTimeout(()=>{
      this.log.ifDebug(LogType.WARNING, strings.mqtt.idleConnection, this.dependency.parentName);
      this.reconnect();
    }, IDLE_CONNECTION_TIMER_INTERVAL); 
  }

  private static readonly KNOWN_KEYS = [...Object.keys(MQTTKey), 'device_name', 'serial_number', 'transactionId', '@SIGNAL'];
  private static readonly STORAGE_KEY = `${PLATFORM_NAME}_MQTT`;
  private async saveData(data: Record<string, PrimitiveTypes | object>) {
  
    const objectString = await storage.get(MQTT.STORAGE_KEY);
    const valuesObject = objectString ? JSON.parse(objectString) : {};
  
    let changed = false;
  
    for (const [key, valueOrObject] of Object.entries(data)) {
  
      if (MQTT.KNOWN_KEYS.includes(key)) {
        continue;
      }
  
      let valuesArray = valuesObject[key] ?? [];
      while (valuesArray.length > 4) {
        valuesArray.shift();
      }
  
      const value = typeof valueOrObject === 'object' ? JSON.stringify(valueOrObject) : valueOrObject;

      const valuesSet = new Set(valuesArray);
      valuesSet.add(value);
  
      valuesArray = Array.from(valuesSet);
  
      valuesObject[key] = valuesArray;
  
      changed = true;
    }
  
    if (changed) {
      storage.set(MQTT.STORAGE_KEY, JSON.stringify(valuesObject));
    }
  }
}
