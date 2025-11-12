import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { ThermostatAccessory } from '../homebridge/thermostatAccessory.js';
import { WaterHeaterAccessory } from '../homebridge/waterHeaterAccessory.js';

import { setLanguage, strings } from '../i18n/i18n.js';

import { EconetApi  } from '../model/api.js';
import { EquipmentType } from '../model/constants.js';
import { Equipment } from '../model/equipment.js';
import { Thermostat } from '../model/thermostat.js';
import { WaterHeater } from '../model/waterHeater.js';

import { Log } from '../tools/log.js';
import { Storage } from '../tools/storage.js';
import getVersion from '../tools/version.js';

export class EconetRheemPlatform implements DynamicPlatformPlugin {
  public readonly Service;
  public readonly Characteristic;

  public readonly log: Log;

  private readonly accessories: Map<string, PlatformAccessory> = new Map();
  private econetApi: EconetApi | null = null;

  constructor(
    logger: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    const userLang = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0];
    setLanguage(userLang);

    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.log = new Log(logger, config.verbose);

    this.log.always(
      'v%s | System %s | Node %s | HB v%s | HAPNodeJS v%s',
      getVersion(),
      process.platform,
      process.version,
      api.serverVersion,
      api.hap.HAPLibraryVersion(),
    );

    this.api.on('didFinishLaunching', () => {
      this.setup();
    });

    this.api.on('shutdown', () => {
      this.teardown();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.always(strings.startup.restoringDevice, accessory.displayName);
    this.accessories.set(accessory.context.serialNumber, accessory);
  }

  private teardown() {
    this.econetApi?.teardown();
  }

  private async setup(): Promise<void> {
    await Storage.init(this.api.user.persistPath());

    const email = this.config.email as string;
    const password = this.config.password as string;
    const debugMQTT = this.config.mqtt_debug as boolean;

    if (!email || !password) {
      this.log.error(strings.startup.badConfig);
      return;
    }

    try {

      this.econetApi = await EconetApi.connect(this.log, email, password, debugMQTT);

      const equipments = Array.from(this.econetApi.equipments.values());

      if (equipments.length === 0) {
        this.log.warning(strings.startup.noEquipment);
        this.teardown();
        return;
      }

      const keepSerials = new Set<string>();

      equipments.forEach(equipment => {
        keepSerials.add(equipment.serialNumber);
        this.initializeAccessory(equipment);
      });

      this.accessories.forEach( accessory => {
        if (!keepSerials.has(accessory.context.serialNumber)) {
          this.removeAccessory(accessory);
        }
      });

    } catch (error) {
      this.log.error(strings.startup.setupFailed, error instanceof Error ? error.message : String(error));
    }
  }

  private initializeAccessory(equipment: Equipment) {

    let accessory = this.accessories.get(equipment.serialNumber);
    if (!accessory) {

      const deviceName = equipment.deviceName;
      this.log.always(strings.startup.newEquipment, deviceName);

      const uuid = this.api.hap.uuid.generate(equipment.serialNumber);

      accessory = new this.api.platformAccessory(deviceName, uuid);
      accessory.context.serialNumber = equipment.serialNumber;

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

      this.accessories.set(equipment.serialNumber, accessory);
    }

    switch(equipment.type) {
    case EquipmentType.THERMOSTAT:
      new ThermostatAccessory(this, accessory, equipment as Thermostat);
      break;
    case EquipmentType.WATER_HEATER:
      new WaterHeaterAccessory(this, accessory, equipment as WaterHeater, this.config.wh_sim_disable);
    }
  }

  private removeAccessory(accessory: PlatformAccessory) {
    this.log.always(strings.startup.removeDevice, accessory.displayName);
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.accessories.delete(accessory.context.serialNumber);
  }
}
