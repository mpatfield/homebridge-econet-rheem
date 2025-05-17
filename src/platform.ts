import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { EconetApi } from './model/econet.js';

import { ThermostatAccessory } from './accessories/thermostatAccessory.js';
import { WaterHeaterAccessory } from './accessories/waterHeaterAccessory.js';

import { WATER_HEATER, THERMOSTAT } from './model/econet.js';
import { Thermostat } from './model/thermostat.js';
import { WaterHeater } from './model/waterHeater.js';

import { TemperatureUnits } from './model/enums.js';
import getVersion from './model/utils.js';

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

  get version(): string {
    if (this.config.test_version) {
      return getVersion();
    } else {
      return '0.0.0';
    }
  }

  private async discoverDevices(): Promise<void> {
    const email = this.config.email as string;
    const password = this.config.password as string;
    const verbose = this.config.verbose as boolean;

    if (!email || !password) {
      this.log.error('Configuration error: "email" and "password" are required in config.json');
      return;
    }

    try {

      this.econetApi = await EconetApi.login(this.log, email, password, this.api.user.storagePath(), verbose);

      const equipmentMap = await this.econetApi.getEquipmentByType([THERMOSTAT, WATER_HEATER]);

      const thermostats = equipmentMap.get(THERMOSTAT) as Thermostat[] || [];
      const waterHeaters = equipmentMap.get(WATER_HEATER) as WaterHeater[] || [];
      const currentSerialNumbers = new Set<string>();

      for (const thermostat of thermostats) {
        const serialNumber = thermostat.serialNumber;
        currentSerialNumbers.add(serialNumber);

        const deviceName = thermostat.deviceName;

        const existingAccessory = this.accessories.get(serialNumber);
        if (existingAccessory) {
          this.log.info('Updating existing thermostat:', deviceName);
          new ThermostatAccessory(this, existingAccessory, thermostat);
        } else {
          this.log.info('Adding new thermostat:', deviceName);
          const uuid = this.api.hap.uuid.generate(serialNumber);
          const accessory = new this.api.platformAccessory(deviceName, uuid);
          accessory.context.serialNumber = serialNumber;
          new ThermostatAccessory(this, accessory, thermostat);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.set(serialNumber, accessory);
        }
      }

      for (const waterHeater of waterHeaters) {
        const serialNumber = waterHeater.serialNumber;
        currentSerialNumbers.add(serialNumber);

        const deviceName = waterHeater.deviceName;

        const existingAccessory = this.accessories.get(serialNumber);
        if (existingAccessory) {
          this.log.info('Updating existing water heater:', deviceName);
          new WaterHeaterAccessory(this, existingAccessory, waterHeater, this.whInputTemp(waterHeater.units));
        } else {
          this.log.info('Adding new water heater:', deviceName);
          const uuid = this.api.hap.uuid.generate(serialNumber);
          const accessory = new this.api.platformAccessory(deviceName, uuid);
          accessory.context.serialNumber = serialNumber;
          new WaterHeaterAccessory(this, accessory, waterHeater, this.whInputTemp(waterHeater.units));
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

  private whInputTemp(units: TemperatureUnits) : number | null {

    if (this.config.wh_sim_disable) {
      return null;
    }

    const month = new Date().getMonth();
  
    // Coldest: Jan, Feb, Dec
    if (month === 0 || month === 1 || month === 11) {
      return units === TemperatureUnits.FAHRENHEIT ? 50 : 10;
    }

    // Hottest: Jun, Jul, Aug
    if (month === 5 || month === 6 || month === 7) {
      return units === TemperatureUnits.FAHRENHEIT ? 70 : 20;
    }

    // All other months
    return units === TemperatureUnits.FAHRENHEIT ? 60 : 15;
  }
}
