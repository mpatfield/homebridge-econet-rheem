// platform.ts
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { EconetApi } from './model/econet.js';

import { ThermostatAccessory } from './accessories/thermostatAccessory.js';
import { WaterHeaterAccessory } from './accessories/waterHeaterAccessory.js';

import { WATER_HEATER, THERMOSTAT } from './model/econet.js';
import { Thermostat } from './model/thermostat.js';
import { WaterHeater } from './model/waterHeater.js';

export class EconetRheemPlatform implements DynamicPlatformPlugin {
  public readonly Service;
  public readonly Characteristic;

  private readonly accessories: Map<string, PlatformAccessory> = new Map();
  private econetApi: EconetApi | null = null;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });

    this.api.on('shutdown', () => {
      if (this.econetApi) {
        this.econetApi.unsubscribe();
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Restoring cached accessory:', accessory.displayName);
    this.accessories.set(accessory.context.serialNumber, accessory);
  }

  private async discoverDevices(): Promise<void> {
    const email = this.config.email as string;
    const password = this.config.password as string;
    const verbose = this.config.debug as boolean;

    if (!email || !password) {
      this.log.error('Configuration error: "email" and "password" are required in config.json');
      return;
    }

    try {

      this.econetApi = await EconetApi.login(this.log, email, password, verbose);

      const equipmentMap = await this.econetApi.getEquipmentByType([THERMOSTAT, WATER_HEATER]);

      const thermostats = equipmentMap.get(THERMOSTAT) || [];
      const waterHeaters = equipmentMap.get(WATER_HEATER) || [];
      const currentSerialNumbers = new Set<string>();

      for (const thermostat of thermostats) {
        const serialNumber = thermostat.serialNumber;
        currentSerialNumbers.add(serialNumber);
        const existingAccessory = this.accessories.get(serialNumber);

        if (existingAccessory) {
          this.log.info('Updating existing thermostat:', thermostat.deviceName);
          new ThermostatAccessory(this, existingAccessory, thermostat as Thermostat);
        } else {
          this.log.info('Adding new thermostat:', thermostat.deviceName);
          const uuid = this.api.hap.uuid.generate(serialNumber);
          const accessory = new this.api.platformAccessory(thermostat.deviceName, uuid);
          accessory.context.serialNumber = serialNumber;
          new ThermostatAccessory(this, accessory, thermostat as Thermostat);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.set(serialNumber, accessory);
        }
      }

      for (const waterHeater of waterHeaters) {
        const serialNumber = waterHeater.serialNumber;
        currentSerialNumbers.add(serialNumber);
        const existingAccessory = this.accessories.get(serialNumber);

        if (existingAccessory) {
          this.log.info('Updating existing water heater:', waterHeater.deviceName);
          new WaterHeaterAccessory(this, existingAccessory, waterHeater as WaterHeater);
        } else {
          this.log.info('Adding new water heater:', waterHeater.deviceName);
          const uuid = this.api.hap.uuid.generate(serialNumber);
          const accessory = new this.api.platformAccessory(waterHeater.deviceName, uuid);
          accessory.context.serialNumber = serialNumber;
          new WaterHeaterAccessory(this, accessory, waterHeater as WaterHeater);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.set(serialNumber, accessory);
        }
      }

      for (const [serialNumber, accessory] of this.accessories) {
        if (!currentSerialNumbers.has(serialNumber)) {
          this.log.info('Removing stale accessory:', accessory.displayName);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.delete(serialNumber);
        }
      }

      this.econetApi.subscribe();
      this.log.debug('Subscribed to Econet MQTT updates');
    } catch (error) {
      this.log.error('Failed to initialize platform:', error instanceof Error ? error.message : String(error));
    }
  }
}
