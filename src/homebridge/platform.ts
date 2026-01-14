import { API, DynamicPlatformPlugin, Logger, PlatformAccessory } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { initEveCharacteristics } from '../accessory/characteristic/eve.js';
import { BaseAccessory } from '../accessory/abstract/base.js';
import { createAccessory } from '../accessory/abstract/helper.js';

import { DeviceAuth, UserAuth } from '../model/auth.js';
import { EconetApi } from '../model/http.js';
import { History } from '../model/history.js';
import { AccessoryDependency, PlatformConfig } from '../model/types.js';

import { setLanguage, strings } from '../i18n/i18n.js';

import { Log } from '../tools/log.js';
import { Properties } from '../tools/properties.js';
import getVersion from '../tools/version.js';

export class EconetRheemPlatform implements DynamicPlatformPlugin {

  private readonly log: Log;

  private readonly platformAccessories: Map<string, PlatformAccessory> = new Map();
  private readonly accessories: BaseAccessory[] = [];

  constructor(
    logger: Logger,
    private readonly config: PlatformConfig,
    private readonly api: API,
  ) {

    const userLang = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0];
    setLanguage(userLang);

    this.log = new Log(logger, config.verbose);

    this.log.always(
      'v%s | System %s | Node %s | HB v%s | HAPNodeJS v%s',
      getVersion(),
      process.platform,
      process.version,
      api.serverVersion,
      api.hap.HAPLibraryVersion(),
    );

    initEveCharacteristics(api);

    this.api.on('didFinishLaunching', () => {
      this.setup();
    });

    this.api.on('shutdown', () => {
      this.teardown();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.always(strings.startup.restoringDevice, accessory.displayName);
    this.platformAccessories.set(accessory.context.identifier, accessory);
  }

  private teardown() {
    this.accessories.forEach( accessory => {
      accessory.teardown();
    });
  }
  
  private async setup(): Promise<void> {
    await Properties.initStorage(this.api.user.persistPath());

    const email = this.config.email;
    const password = this.config.password;
    const devices = this.config.devices || [];

    if (!email || !password) {
      this.log.error(strings.startup.badConfig);
      return;
    }

    const equipmentsData = await EconetApi.connect(this.log, email, password, devices);
    if (equipmentsData === undefined) {
      return;
    }

    if (equipmentsData.length === 0) {
      this.log.warning(strings.startup.noEquipment);
      this.teardown();
      return;
    }

    const Service = this.api.hap.Service;
    const Characteristic = this.api.hap.Characteristic;

    const history = new History(this.api, this.log);

    const keepSerials = new Set<string>();

    const userAuth = UserAuth.load(email);
    if (userAuth === undefined) {
      this.log.error('User auth object is missing');
      return;
    }

    for (const equipmentData of equipmentsData) {

      let platformAccessory = this.platformAccessories.get(equipmentData.serial_number);
      if (!platformAccessory) {

        const name = equipmentData['@NAME']?.value ?? equipmentData.device_type;

        const uuid = this.api.hap.uuid.generate(equipmentData.serial_number);

        platformAccessory = new this.api.platformAccessory(name, uuid);
        platformAccessory.context.identifier = equipmentData.serial_number;

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);

        this.platformAccessories.set(equipmentData.serial_number, platformAccessory);

        this.log.always(strings.startup.newEquipment, name);
      }

      let deviceAuth: DeviceAuth | undefined; 

      const device = devices.find( (device) => device.serialNumber === equipmentData.serial_number);
      if (device !== undefined) {

        deviceAuth = DeviceAuth.load(equipmentData.serial_number, email);
        if (deviceAuth === undefined) {
          this.log.warning('Device auth object is missing');
        }
      }

      const dependency: AccessoryDependency = {
        Service,
        Characteristic,
        platformAccessory,
        log: this.log,
        history,
        disableLogging: this.config.verbose !== true,
        debugMQTT: this.config.mqtt_debug === true,
        email: this.config.email,
        auth: deviceAuth ?? userAuth,
      };

      const accessory = createAccessory(dependency, equipmentData);

      if (accessory === undefined) {
        continue;
      }

      keepSerials.add(equipmentData.serial_number);
      this.accessories.push(accessory);

      this.platformAccessories.forEach(accessory => {
        if (!keepSerials.has(accessory.context.identifier)) {
          this.removeAccessory(accessory);
        }
      });
    }

    const randIndex = Math.floor(Math.random() * strings.startup.welcome.length);
    this.log.always(`${strings.startup.complete}\n${strings.startup.welcome[randIndex]}`);
  }

  private removeAccessory(accessory: PlatformAccessory) {
    this.log.always(strings.startup.removeDevice, accessory.displayName);
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.platformAccessories.delete(accessory.context.identifier);
  }
}