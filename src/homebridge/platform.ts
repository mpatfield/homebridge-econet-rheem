import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { ThermostatAccessory } from '../homebridge/thermostatAccessory.js';
import { WaterHeaterAccessory } from '../homebridge/waterHeaterAccessory.js';

import { EconetApi, WATER_HEATER, THERMOSTAT } from '../model/api.js';
import { Thermostat } from '../model/thermostat.js';
import { WaterHeater } from '../model/waterHeater.js';
import getVersion from '../model/utils.js';

import strings from '../lang/en.js';

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

    this.log.info(
      'v%s | System %s | Node %s | HB v%s | HAPNodeJS v%s',
      getVersion(),
      process.platform,
      process.version,
      api.serverVersion,
      api.hap.HAPLibraryVersion(),
    );

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
    this.log.info(strings.restoringDevice, accessory.displayName);
    this.accessories.set(accessory.context.serialNumber, accessory);
  }

  private async discoverDevices(): Promise<void> {
    const email = this.config.email as string;
    const password = this.config.password as string;
    const verbose = this.config.verbose as boolean;
    const debugMQTT = this.config.mqtt_debug as boolean;

    if (!email || !password) {
      this.log.error(strings.badConfig);
      return;
    }

    try {

      this.econetApi = await EconetApi.login(this.log, email, password, this.api.user.storagePath(), verbose, debugMQTT);

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
          new ThermostatAccessory(this, existingAccessory, thermostat);
        } else {
          this.log.info(strings.newThermostat, deviceName);
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
          new WaterHeaterAccessory(this, existingAccessory, waterHeater, this.config.wh_sim_disable);
        } else {
          this.log.info(strings.newWaterHeater, deviceName);
          const uuid = this.api.hap.uuid.generate(serialNumber);
          const accessory = new this.api.platformAccessory(deviceName, uuid);
          accessory.context.serialNumber = serialNumber;
          new WaterHeaterAccessory(this, accessory, waterHeater, this.config.wh_sim_disable);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.set(serialNumber, accessory);
        }
      }

      for (const [serialNumber, accessory] of this.accessories) {
        if (!currentSerialNumbers.has(serialNumber)) {
          this.log.info(strings.removeDevice, accessory.displayName);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.delete(serialNumber);
        }
      }

      this.econetApi.subscribe();

    } catch (error) {
      this.log.error(strings.setupFailed, error instanceof Error ? error.message : String(error));
    }
  }
}
