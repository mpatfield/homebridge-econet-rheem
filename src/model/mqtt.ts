import mqtt from 'mqtt';
import storage from 'node-persist';

import { DeviceAuth, UserAuth } from './auth.js';
import { Equipment } from './equipment.js';
import { UserMQTTData, MQTTError } from './types.js';

import { strings } from '../i18n/i18n.js';

import { CLEARBLADE_HOST, CLEARBLADE_KEY } from '../homebridge/settings.js';

import { Log, LogType } from '../tools/log.js';
import { DELAYS, MINUTE, SECOND } from '../tools/time.js';

const BROKER_URL = `mqtts://${CLEARBLADE_HOST}:1884`;
const TOPIC_REPORTED = 'user/%s/device/reported';
const TOPIC_DESIRED = 'user/%s/device/desired';
const TOPIC_DEVICE = 'device/%s/%s/4736/reported';

const KEEPALIVE = 90;

const IDLE_CONNECTION_TIMER_INTERVAL = 16 * MINUTE;

enum Type {
  USER,
  DEVICE
}

export class EconetMQTT {
  
  private client?: mqtt.MqttClient;
  private idleTimer?: NodeJS.Timeout;

  private shouldReconnect = true;
  private isReconnecting = false;
  private reconnectCount = 0;

  static connectUserClient(auth: UserAuth, email: string, equipments: Map<string, Equipment>,
    log: Log, debug: boolean, onUnstable: () => (Promise<void>)): EconetMQTT {

    const topics = [
      TOPIC_REPORTED.replace('%s', auth.accountId),
      TOPIC_DESIRED.replace('%s', auth.accountId),
    ];

    const timeString = Date.now().toString().replace('.', '').slice(0, 13);
    const clientId = `${email}${timeString}_android`;

    const mqtt = new EconetMQTT(Type.USER, auth.token, topics, clientId, equipments, log, debug, onUnstable);

    mqtt.connect(true);

    return mqtt;
  }

  static connectDeviceClient(auth: DeviceAuth, equipments: Map<string, Equipment>, log: Log, debug: boolean, onUnstable: () => (Promise<void>)) {

    const equipment = equipments.entries().next().value?.[1];
    if (equipment === undefined) {
      throw new Error('Device client requires equipment');
    }

    const topics = [
      TOPIC_DEVICE.replace('%s', equipment.macAddress).replace('%s', equipment.serialNumber),
    ];

    const mqtt = new EconetMQTT(Type.DEVICE, auth.token, topics, undefined, equipments, log, debug, onUnstable);

    mqtt.connect();

    return mqtt;
  }

  private constructor(
    private readonly type: Type,
    private readonly token: string,
    private readonly topics: string[],
    private readonly clientId: string | undefined,
    private readonly equipments: Map<string, Equipment>,
    private readonly log: Log,
    private readonly debug: boolean,
    private readonly onUnstable: (() => (Promise<void>)) | undefined = undefined,
  ) {
  }

  private connect(showStartupMessage: boolean = false) {
    
    const options = {
      clientId: this.clientId,
      username: this.token,
      password: CLEARBLADE_KEY,
      rejectUnauthorized: true,
      keepalive: KEEPALIVE,
      reconnectPeriod: 0,
    };
    
    this.client = mqtt.connect(BROKER_URL, options);
    
    this.client.on('connect', () => this.subscribe(showStartupMessage) );
    
    this.client.on('message', (topic, message) => this.messageReceived(topic, message.toString()));
    
    this.client.on('close', () => this.connectionClosed());
    
    this.client.on('error', (error: MQTTError) => this.log.ifVerbose(LogType.WARNING, this.string('deviceClientError', 'userClientError'), error));
  }

  publish(accountId: string, payload: { [key: string]: number }, deviceId: string, serialNumber: string) {

    if (!this.client || !this.client.connected) {
      this.log.error(this.string('deviceNotConnected', 'userNotConnected'));
      return;
    }

    const dateTime = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const transactionId = `ANDROID_${dateTime}`;

    const data = {
      transactionId,
      device_name: deviceId,
      serial_number: serialNumber,
      ...payload,
    };

    const topic = TOPIC_DESIRED.replace('%s', accountId);
    const message = JSON.stringify(data);

    this.client.publish(topic, message);

    this.log.ifVerbose(`${this.publish.name}() —`, topic, `\n${JSON.stringify(data)}`);
  }

  teardown() {
    this.shouldReconnect = false;

    if (this.client) {
      this.client.end(true);
      this.client = undefined;
    }
  }

  private subscribe(showStartupMessage: boolean) {
    
    if (!this.client) {
      this.log.error(this.string('deviceConnectionError', 'userConnectionError'));
      return;
    }
    
    for (const topic of this.topics) {
      this.client.subscribe(topic);
    }

    this.log.always(this.string('deviceConnected', 'userConnected'));

    if (showStartupMessage) {
      const randIndex = Math.floor(Math.random() * strings.startup.welcome.length);
      this.log.always(strings.startup.setupComplete, strings.startup.welcome[randIndex]);
    }
  }

  private messageReceived(topic: string, message: string) {

    this.reconnectCount = 0;
    this.resetIdleTimer();

    try {

      const data = JSON.parse(message);

      switch (this.type) {
      case Type.DEVICE: {
        const equipment = this.equipments.entries().next().value?.[1];
        equipment!.updateFromDeviceMQTT(data);
        break;
      }
      case Type.USER: {
        const equipment = data.serial_number ? this.equipments.get(data.serial_number) : undefined;
        if (equipment === undefined) {
          return;
        }
        equipment.updateFromUserMQTT(data);
        break;
      }
      }

      this.log.ifVerbose(`${this.messageReceived.name}() —`, topic, `\n${JSON.stringify(data)}`);

      if (this.debug) {
        this.saveData(data);
      }

    } catch (e) {
      this.log.warning(this.string('deviceParseFailed', 'userParseFailed'), JSON.stringify(message));
    }
  }

  private connectionClosed() {
    this.log.ifVerbose(this.string('deviceConnectionClosed', 'deviceConnectionClosed'));
    this.reconnect();
  }

  private resetIdleTimer() {

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(()=>{
      this.log.ifVerbose(this.string('deviceIdleConnection', 'userIdleConnection'));
      this.reconnect();
    }, IDLE_CONNECTION_TIMER_INTERVAL); 
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
        this.log.ifVerbose(strings.mqtt.unstableConnection);
        this.log.ifVerbose(strings.http.reauthenticate);
        await this.onUnstable?.();
      } catch (error) {
        this.log.ifVerbose(strings.http.reauthFailed, error);
      }
    }

    const reconnectDelay = DELAYS[Math.min(this.reconnectCount, DELAYS.length - 1)];
    if (reconnectDelay < MINUTE) {
      this.log.ifVerbose(this.string('deviceReconnectInSeconds', 'userReconnectInSeconds'), reconnectDelay / SECOND);
    } else {
      this.log.ifVerbose(this.string('deviceReconnectInMinutes', 'userReconnectInMinutes'), reconnectDelay / MINUTE);
    }

    setTimeout(() => {
      this.isReconnecting = false;
      this.connect();
    }, reconnectDelay);
  }

  private string(deviceLog: keyof typeof strings.mqtt, userLog: keyof typeof strings.mqtt): string {
    switch (this.type) {
    case Type.DEVICE:
      return strings.mqtt[deviceLog];
    case Type.USER:
      return strings.mqtt[userLog];
    }
  }

  private async saveData(data: UserMQTTData) {
  
    const objectString = await storage.get('mqtt');
    const valuesObject = objectString ? JSON.parse(objectString) : {};
  
    let changed = false;
  
    for (const [key, value] of Object.entries(data)) {
  
      if (key === 'transactionId' || value.toString.length === 0) {
        continue;
      }
  
      let valuesArray = valuesObject[key] ?? [];
      while (valuesArray.length > 4) {
        valuesArray.shift();
      }
  
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