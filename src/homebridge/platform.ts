import { API, DynamicPlatformPlugin, Logger, PlatformAccessory } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { initEveCharacteristics } from '../accessory/characteristic/eve.js';
import { BaseAccessory } from '../accessory/abstract/base.js';
import { createAccessory } from '../accessory/abstract/helper.js';

import { DeviceAuth, UserAuth } from '../model/auth.js';
import { EconetApi, EconetApiDependency } from '../model/http.js';
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

    setLanguage(api.user.configPath());

    this.log = new Log(logger, config.debug === true);

    this.log.ifDebug(
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
    this.log.ifDebug(strings.startup.restoringDevice, accessory.displayName);
    this.platformAccessories.set(accessory.context.serialNumber, accessory);
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

    if (!email || email.length === 0 || !password || password.length === 0) {
      this.log.error(strings.startup.badConfig);
      return;
    }

    const dependency: EconetApiDependency = {
      log: this.log,
      email,
      password,
      devices,
      disableLogging: this.config.disableLogging === true,
      debug: this.config.debug === true,
    };

    const equipmentsData = await EconetApi.connect(dependency);
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

    const history = new History(this.api, this.log, this.config.enableHistory === true);

    const keepSerials = new Set<string>();

    const userAuth = UserAuth.load(email);
    if (userAuth === undefined) {
      this.log.error('User auth object is missing');
      return;
    }

    for (const equipmentData of equipmentsData) {

      const name = equipmentData['@NAME']?.value ?? equipmentData.device_type;

      let platformAccessory = this.platformAccessories.get(equipmentData.serial_number);
      if (!platformAccessory) {

        const uuid = this.api.hap.uuid.generate(equipmentData.serial_number);

        platformAccessory = new this.api.platformAccessory(name, uuid);
        platformAccessory.context.serialNumber = equipmentData.serial_number;

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);

        this.platformAccessories.set(equipmentData.serial_number, platformAccessory);

        this.log.always(strings.startup.newEquipment, name);
      }

      if (name !== platformAccessory.displayName) {
        platformAccessory.updateDisplayName(name);
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
        disableLogging: this.config.disableLogging === true,
        debug: this.config.debug === true,
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
        if (!keepSerials.has(accessory.context.serialNumber)) {
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
    this.platformAccessories.delete(accessory.context.serialNumber);
  }
}