import { Logger } from 'homebridge';

import mqtt from 'mqtt';

import { Equipment } from './equipment.js';
import { WaterHeater } from './waterHeater.js';
import { Thermostat } from './thermostat.js';

const HOST = 'rheem.clearblade.com';
const REST_URL = `https://${HOST}/api/v/1`;
const CLEAR_BLADE_SYSTEM_KEY = 'e2e699cb0bb0bbb88fc8858cb5a401';
const CLEAR_BLADE_SYSTEM_SECRET = 'E2E699CB0BE6C6FADDB1B0BC9A20';
const HEADERS = {
  'ClearBlade-SystemKey': CLEAR_BLADE_SYSTEM_KEY,
  'ClearBlade-SystemSecret': CLEAR_BLADE_SYSTEM_SECRET,
  'Content-Type': 'application/json; charset=UTF-8',
};

const DEFAULT_RECONNECT_DELAY_SECONDS = 120;
const MAX_RECONNECT_DELAY_SECONDS = 3600;

const RETRYABLE_CODES = [
  3, // MQTT: Server unavailable
  'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET',
  'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH',
];


export const WATER_HEATER = 'WH';
export const THERMOSTAT = 'HVAC';

export class PyeconetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PyeconetError';
  }
}

export class InvalidCredentialsError extends PyeconetError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidResponseFormat extends PyeconetError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResponseFormat';
  }
}

export class GenericHTTPError extends PyeconetError {
  constructor(message: string) {
    super(message);
    this.name = 'GenericHTTPError';
  }
}

interface MqttError extends Error {
  code?: string | number;
}

export class EconetApi {
  public readonly log: Logger;
  private readonly email: string;
  private readonly password: string;
  private readonly verbose: boolean;
  private mqttOptions: mqtt.IClientOptions | null = null;
  private userToken: string | null = null;
  private accountId: string | null = null;
  private equipment: Map<string, Equipment> = new Map();
  private mqttClient: mqtt.MqttClient | null = null;
  private shouldReconnect = false;
  private reconnectDelaySeconds = DEFAULT_RECONNECT_DELAY_SECONDS;
  private isReconnecting = false;
  private reconnectCount = 0;

  constructor(log: Logger, email: string, password: string, verbose: boolean) {
    this.log = log;
    this.email = email;
    this.password = password;
    this.verbose = verbose;    
  }

  static async login(log: Logger, email: string, password: string, verbose: boolean): Promise<EconetApi> {
    const api = new EconetApi(log, email, password, verbose);
    await api.authenticate();
    return api;
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${REST_URL}/user/auth`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    if (response.status === 200) {
      const json = await response.json();
      if (json.options.success) {
        this.log.info('Successfully authenticated');

        this.userToken = json.user_token;
        this.accountId = json.options.account_id;

        const timeString = Date.now().toString().replace('.', '').slice(0, 13);
        const clientId = `${this.email}${timeString}_android`;

        this.mqttOptions = {
          clientId,
          username: this.userToken!,
          password: CLEAR_BLADE_SYSTEM_KEY,
          rejectUnauthorized: true,
          keepalive: 90,
          reconnectPeriod: 0,
        };
      } else {
        throw new InvalidCredentialsError(json.options.message || 'Invalid credentials');
      }
    } else {
      throw new GenericHTTPError(`HTTP error: ${response.status}`);
    }
  }

  subscribe() {
    this.shouldReconnect = true;
    this.connect();
  }

  private connect(): void {
    
    if (!this.equipment.size) {
      this.log.error('No equipment');
      return;
    }

    if (!this.mqttOptions) {
      this.log.error('MQTT options are undefined');
      return;
    }

    this.mqttClient = mqtt.connect(`mqtts://${HOST}:1884`, this.mqttOptions);

    this.mqttClient.on('connect', () => {
      this.reconnectDelaySeconds = DEFAULT_RECONNECT_DELAY_SECONDS;
      this.mqttClient!.subscribe(`user/${this.accountId}/device/reported`);
      this.mqttClient!.subscribe(`user/${this.accountId}/device/desired`);
      this.log.info('Connected and listening for updates...');
    });

    this.mqttClient.on('message', (topic, message) => {
      try {
        const unpackedJson = JSON.parse(message.toString());
        if (this.verbose) {
          this.log.debug(`Received message from topic: ${topic}\n`, JSON.stringify(unpackedJson, null, 2));
        }
        const serial = unpackedJson.serial_number;
        const equipment = this.equipment.get(serial);
        if (equipment) {
          equipment.updateFromMQTT(unpackedJson);
        } else if ('@SIGNAL' in unpackedJson) {
          for (const eq of this.equipment.values()) {
            if (eq.deviceId === unpackedJson.device_name) {
              eq.updateFromMQTT(unpackedJson);
            }
          }
        }
      } catch (e) {
        this.log.error('Failed to parse message:', message.toString());
      }
    });

    this.mqttClient.on('offline', () => {
      this.log.debug('Client offline');
    });

    this.mqttClient.on('close', () => {
      this.log.info('Connection closed');
      this.reconnect();
    });

    this.mqttClient.on('error', (err: MqttError) => {
      if (err.code !== undefined && RETRYABLE_CODES.includes(err.code)) {
        if (this.verbose) {
          this.log.error('Client error:', err);
        }
        this.reconnect();
      } else {
        this.log.error('Client error:', err);
      }
    });
  }

  private async reconnect() {

    if (!this.shouldReconnect || this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;

    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }

    this.reconnectCount++;
    if (this.reconnectCount % 3 === 0) {
      try {
        this.log.error('Having trouble staying connected');
        this.log.info('Attempting to re-authenticate');
        await this.authenticate();
      } catch (error) {
        this.log.error('Re-authentication failed:', error);
      }
    }

    this.log.info(`Will attempt to reconnect in ${this.reconnectDelaySeconds / 60} minutes...`);
    setTimeout(() => {

      this.reconnectDelaySeconds = Math.min(this.reconnectDelaySeconds * 2, MAX_RECONNECT_DELAY_SECONDS);

      this.isReconnecting = false;

      this.connect();

    }, this.reconnectDelaySeconds * 1000);
  }

  publish(payload: { [key: string]: number }, deviceId: string, serialNumber: string): void {

    const dateTime = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const transactionId = `ANDROID_${dateTime}`;
    const publishPayload = {
      transactionId,
      device_name: deviceId,
      serial_number: serialNumber,
      ...payload,
    };
    
    if (!this.mqttClient || !this.mqttClient.connected) {
      this.log.error('Client not connected');
      return;
    }

    const topic = `user/${this.accountId}/device/desired`;
    const message = JSON.stringify(publishPayload, null, 2);
    if (this.verbose) {
      this.log.debug(`Publishing message to topic: ${topic}\n`, message);
    }
    this.mqttClient.publish(topic, message);
  }

  unsubscribe(): void {
    this.shouldReconnect = false;
    if (this.mqttClient) {
      this.mqttClient.end();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getLocation(): Promise<any[]> {
    const headers = { ...HEADERS, 'ClearBlade-UserToken': this.userToken! };
    const payload = {
      location_only: false,
      type: 'com.econet.econetconsumerandroid',
      version: '6.0.0-375-01b4870e',
    };
    const response = await fetch(`${REST_URL}/code/${CLEAR_BLADE_SYSTEM_KEY}/getUserDataForApp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (response.status === 200) {
      const json = await response.json();
      if (json.success) {
        return json.results.locations;
      }
      throw new InvalidResponseFormat('Invalid response format');
    }
    throw new GenericHTTPError(`HTTP error: ${response.status}`);
  }

  async getEquipment(): Promise<void> {
    const locations = await this.getLocation();
    for (const location of locations) {
      for (const equip of location.equiptments) {
        if ('error' in equip) {
          this.log.error(`Equipment error: ${equip.error}`);
          continue;
        }

        if (this.verbose) {
          this.log.debug('Creating Equipment with data:\n', JSON.stringify(equip, null, 2));
        }

        let equipObj: Equipment;
        if (equip.device_type === WATER_HEATER) {
          equipObj = new WaterHeater(this, equip);
        } else if (equip.device_type === THERMOSTAT) {
          equipObj = new Thermostat(this, equip);
        } else {
          continue;
        }

        this.equipment.set(equipObj.serialNumber, equipObj);
        if (equip.device_type === THERMOSTAT && equip.zoning_devices) {
          for (const zoningDevice of equip.zoning_devices) {
            const zoningEquip = new Thermostat(this, zoningDevice);
            this.equipment.set(zoningEquip.serialNumber, zoningEquip);
          }
        }
      }
    }
  }

  async getEquipmentByType(types: string[]): Promise<Map<string, Equipment[]>> {
    if (!this.equipment.size) {
      await this.getEquipment();
    }
    const result = new Map<string, Equipment[]>();
    types.forEach((type) => result.set(type, []));
    for (const equip of this.equipment.values()) {
      if (types.includes(equip instanceof WaterHeater ? WATER_HEATER : THERMOSTAT)) {
        result.get(equip instanceof WaterHeater ? WATER_HEATER : THERMOSTAT)!.push(equip);
      }
    }
    return result;
  }
}
