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
}

export class MQTT {

  private static readonly INSTANCES = new Map<string, MQTT>();

  private client: mqtt.MqttClient | undefined = undefined;

  private idleTimer?: NodeJS.Timeout;

  private shouldReconnect = false;
  private isReconnecting = false;
  private reconnectCount = 0;

  private readonly listeners: MQTTListener[] = [];

  static connect(dependency: MQTTDependency, listener: MQTTListener, debug: boolean): MQTT | undefined {

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
      dependency.log.ifVerbose(strings.mqtt.reuse, dependency.parentName, shortId);

    } else {
      dependency.log.ifVerbose(strings.mqtt.new, dependency.parentName, shortId);

      instance = new MQTT(dependency.log, dependency.parentName, options, topic, debug);
      MQTT.INSTANCES.set(id, instance);

      instance.connect();
    }

    instance.listeners.push(listener);

    return instance;
  }

  private readonly topicDesired: string;
  private readonly topicReported: string;

  private constructor(
    private readonly log: Log,
    private readonly parentName: string,
    private readonly options: mqtt.IClientOptions,
    topicBase: string,
    private readonly debug: boolean,
  ) {
    this.topicDesired = topicBase + 'desired';
    this.topicReported = topicBase + 'reported';
  }

  private connect(): void {

    this.shouldReconnect = true;

    this.client = mqtt.connect(BROKER_URL, this.options);

    this.client.on('connect', () => {
      this.log.ifVerbose(strings.mqtt.connected, this.parentName);
      this.client?.subscribe(this.topicReported); // TODO subscribe to desired also?
    });

    this.client.on('message', (topic, message) => this.messageReceived(topic, message.toString()));

    this.client.on('close', () => {
      this.log.ifVerbose(strings.mqtt.disconnected, this.parentName);
      this.reconnect();
    });

    this.client.on('error', (error: MQTTError) => {
      this.log.ifVerbose(LogType.WARNING, `${strings.mqtt.error}: ${error}`,  this.parentName);
    });
  }

  public teardown(): void {
    this.shouldReconnect = false;
    this.client?.end(true);
    this.client = undefined;
  }

  private messageReceived(topic: string, message: string) {

    this.log.ifVerbose(`${this.parentName} ${this.messageReceived.name}() - ${topic}\n${message}`);

    this.reconnectCount = 0;
    this.resetIdleTimer();

    try {

      const parsed = JSON.parse(message);
      for (const listener of this.listeners) {
        listener.mqttMessageReceived(parsed);
      }

      if (this.debug) {
        this.saveData(parsed);
      }

    } catch (e) {
      this.log.error(strings.mqtt.parseFailed, this.parentName, `- ${topic}\n${message}`);
    }
  }

  public publish(payload: Record<string, PrimitiveTypes>): void {

    if (!this.client || !this.client.connected) {
      this.log.error(strings.mqtt.notConnected, this.parentName);
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
    this.log.ifVerbose( `${this.parentName} ${this.publish.name}() — ${this.topicDesired} ${message}`);

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
        this.log.ifVerbose(LogType.WARNING, strings.mqtt.unstable, this.parentName);
        await EconetApi.authenticateUser();
      } catch (error) {
        this.log.ifVerbose(LogType.ERROR, strings.http.reauthFailed, this.parentName, JSON.stringify(error));
      }
    }

    const reconnectDelay = DELAYS[Math.min(this.reconnectCount, DELAYS.length - 1)];
    if (reconnectDelay < MINUTE) {
      this.log.ifVerbose(strings.mqtt.reconnectSeconds, this.parentName, reconnectDelay / SECOND);
    } else {
      this.log.ifVerbose(strings.mqtt.reconnectMinutes, this.parentName, reconnectDelay / MINUTE);
    }

    setTimeout(() => {
      this.isReconnecting = false;
      this.connect();
    }, reconnectDelay);
  }

  private resetIdleTimer() {

    clearTimeout(this.idleTimer);

    this.idleTimer = setTimeout(()=>{
      this.log.ifVerbose(LogType.WARNING, strings.mqtt.idleConnection, this.parentName);
      this.reconnect();
    }, IDLE_CONNECTION_TIMER_INTERVAL); 
  }

  private readonly KNOWN_KEYS = [...Object.keys(MQTTKey), 'transactionId'];
  private async saveData(data: Record<string, PrimitiveTypes | object>) {
  
    const objectString = await storage.get(`${PLATFORM_NAME}_MQTT`);
    const valuesObject = objectString ? JSON.parse(objectString) : {};
  
    let changed = false;
  
    for (const [key, valueOrObject] of Object.entries(data)) {
  
      if (this.KNOWN_KEYS.includes(key)) {
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
      storage.set('mqtt', JSON.stringify(valuesObject));
    }
  }
}
