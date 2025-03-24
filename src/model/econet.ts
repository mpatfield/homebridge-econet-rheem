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

export class EconetApi {
  public readonly log: Logger;
  private readonly email: string;
  private readonly verbose: boolean;
  private _userToken: string | null = null;
  private _accountId: string | null = null;
  private _equipment: Map<string, Equipment> = new Map();
  private _mqttClient: mqtt.MqttClient | null = null;

  constructor(log: Logger, email: string, verbose: boolean) {
    this.log = log;
    this.email = email;
    this.verbose = verbose;
  }

  get userToken(): string | null {
    return this._userToken;
  }

  get accountId(): string | null {
    return this._accountId;
  }

  static async login(log: Logger, email: string, password: string, verbose: boolean): Promise<EconetApi> {
    const api = new EconetApi(log, email, verbose);
    await api._authenticate({ email, password });
    return api;
  }

  private async _authenticate(payload: { email: string; password: string }): Promise<void> {
    const response = await fetch(`${REST_URL}/user/auth`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
    if (response.status === 200) {
      const json = await response.json();
      if (json.options.success) {
        this._userToken = json.user_token;
        this._accountId = json.options.account_id;
      } else {
        throw new InvalidCredentialsError(json.options.message || 'Invalid credentials');
      }
    } else {
      throw new GenericHTTPError(`HTTP error: ${response.status}`);
    }
  }

  private _getClientId(): string {
    const timeString = Date.now().toString().replace('.', '').slice(0, 13);
    return `${this.email}${timeString}_android`;
  }

  subscribe(): void {
    if (!this._equipment.size) {
      return;
    }

    const clientId = this._getClientId();
    const connectionOptions: mqtt.IClientOptions = {
      clientId,
      username: this._userToken!,
      password: CLEAR_BLADE_SYSTEM_KEY,
      rejectUnauthorized: true,
      keepalive: 90,
    };

    this._mqttClient = mqtt.connect(`mqtts://${HOST}:1884`, connectionOptions);

    this._mqttClient.on('connect', () => {
      this._mqttClient!.subscribe(`user/${this._accountId}/device/reported`);
      this._mqttClient!.subscribe(`user/${this._accountId}/device/desired`);
    });

    this._mqttClient.on('message', (topic, message) => {
      try {
        const unpackedJson = JSON.parse(message.toString());
        if (this.verbose) {
          this.log.debug(`Received MQTT message from topic: ${topic}\n`, JSON.stringify(unpackedJson, null, 2));
        }
        const serial = unpackedJson.serial_number;
        const equipment = this._equipment.get(serial);
        if (equipment) {
          equipment.updateFromMQTT(unpackedJson);
        } else if ('@SIGNAL' in unpackedJson) {
          for (const eq of this._equipment.values()) {
            if (eq.deviceId === unpackedJson.device_name) {
              eq.updateFromMQTT(unpackedJson);
            }
          }
        }
      } catch (e) {
        this.log.error('Failed to parse MQTT message:', message.toString());
      }
    });

    this._mqttClient.on('offline', () => {
      this.log.debug('MQTT client went offline');
    });

    let reconnectAttempts = 1;
    this._mqttClient.on('close', () => {
      this.log.debug('MQTT connection closed, attempting to reconnect...');
      setTimeout(() => {
        this._mqttClient!.reconnect(connectionOptions);
        reconnectAttempts*=2;
      }, Math.min(300000, 5000 * reconnectAttempts)); // Exponential backoff: 5s, 10s, 20s... 300s
    });

    this._mqttClient.on('error', (err) => {
      this.log.error('MQTT error:', err);
    });
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
    if (this._mqttClient) {
      const topic = `user/${this._accountId}/device/desired`;
      const payload = JSON.stringify(publishPayload, null, 2);
      this.log.debug(`Publishing MQTT message to topic: ${topic}\n`, payload);
      this._mqttClient.publish(topic, payload);
    }
  }

  unsubscribe(): void {
    if (this._mqttClient) {
      this._mqttClient.end();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _getLocation(): Promise<any[]> {
    const headers = { ...HEADERS, 'ClearBlade-UserToken': this._userToken! };
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
    const locations = await this._getLocation();
    for (const location of locations) {
      for (const equip of location.equiptments) {
        if ('error' in equip) {
          this.log.error(`econet equipment error: ${equip.error}`);
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

        this._equipment.set(equipObj.serialNumber, equipObj);
        if (equip.device_type === THERMOSTAT && equip.zoning_devices) {
          for (const zoningDevice of equip.zoning_devices) {
            const zoningEquip = new Thermostat(this, zoningDevice);
            this._equipment.set(zoningEquip.serialNumber, zoningEquip);
          }
        }
      }
    }
  }

  async getEquipmentByType(types: string[]): Promise<Map<string, Equipment[]>> {
    if (!this._equipment.size) {
      await this.getEquipment();
    }
    const result = new Map<string, Equipment[]>();
    types.forEach((type) => result.set(type, []));
    for (const equip of this._equipment.values()) {
      if (types.includes(equip instanceof WaterHeater ? WATER_HEATER : THERMOSTAT)) {
        result.get(equip instanceof WaterHeater ? WATER_HEATER : THERMOSTAT)!.push(equip);
      }
    }
    return result;
  }
}
