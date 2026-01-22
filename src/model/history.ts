import { F_OK } from 'constants';
import fakegato, { HistoryServiceProvider, HistoryService } from 'fakegato-history';
import { access, unlink } from 'fs/promises';
import { API, CharacteristicValue, Nullable, PlatformAccessory } from 'homebridge';
import path from 'path';

import { EveCharacteristicKey } from './enums.js';

import { BaseAccessory } from '../accessory/abstract/base.js';
import { EveCharacteristic } from '../accessory/characteristic/eve.js';

import { strings } from '../i18n/i18n.js';

import { Log } from '../tools/log.js';
import { SECOND } from '../tools/time.js';

export enum HistoryType {
  CUSTOM = 'custom',
  WEATHER = 'weather',
}

export type HistoryEntry = {
  humidity?: number,
  power?: number,
  status?: number,
  temp?: number,
  time?: number,
}

type HistoryOptions = {
  filename?: string,
  path?: string,
  size?: number,
  storage?: 'fs',
}

type Accessory = BaseAccessory;

let ServiceProvider: HistoryServiceProvider | undefined;

const HISTORY_UUID = 'd08afca9-1791-4d50-a580-7b343f5a22b3';

function HistoryService(type: HistoryType, accessory: PlatformAccessory, options?: HistoryOptions): HistoryService {

  if (!ServiceProvider) {
    throw new Error('HistoryServiceProvider not initialized');
  }

  return new ServiceProvider(type, accessory, options);
}

export class History {

  private readonly historyServices = new Map<string, HistoryService>();
  private readonly persistPath: string;

  private readonly cleanedUp = new Set<string>();

  constructor(private readonly api: API, private readonly log: Log, private readonly enabled: boolean) {

    if (ServiceProvider) {
      throw new Error('HistoryServiceProvider already initialized');
    }

    ServiceProvider = fakegato(api);
    this.persistPath = api.user.persistPath();
  }

  public record(accessory: Accessory, type: HistoryType, entry: HistoryEntry, updateLastActivation: boolean = false) {

    if (!this.enabled) {
      this.cleanup(accessory);
      return;
    }

    const historyService = this.historyServices.get(accessory.identifier)
      ?? this.createHistoryService(accessory, type, updateLastActivation);

    const time = Math.floor(Date.now() / 1000);
    entry = {
      time: time,
      ...entry,
    };

    this.log.ifDebug(strings.history.entry, accessory.name, JSON.stringify(entry));

    historyService.addEntry(entry);

    if (updateLastActivation && !isNaN(historyService.getInitialTime())) {
      const lastActivation = time - historyService.getInitialTime();
      accessory.setProperty(EveCharacteristicKey.LastActivation, lastActivation);
      accessory.service.updateCharacteristic(EveCharacteristic(EveCharacteristicKey.LastActivation), lastActivation);
    }

    return;
  }

  private createHistoryService(accessory: Accessory, type: HistoryType, addLastActivation: boolean): HistoryService {

    const options: HistoryOptions = {
      size: 4032,
      storage: 'fs',
      path: this.persistPath,
      filename: this.getFilename(accessory),
    };

    const historyService = HistoryService(type, accessory.platformAccessory, options);
    this.historyServices.set(accessory.identifier, historyService);

    if (!addLastActivation) {
      return historyService;
    }

    setTimeout( () => {

      if (historyService.lastEntry === undefined || historyService.memorySize === undefined) {
        return;
      }

      const entry = historyService.history[ historyService.lastEntry % historyService.memorySize ];
      if (entry === undefined || entry.time === undefined) {
        return;
      }

      const lastActivation = entry.time - historyService.getInitialTime();
      accessory.setProperty(EveCharacteristicKey.LastActivation, lastActivation);

      accessory.service.addOptionalCharacteristic(EveCharacteristic(EveCharacteristicKey.LastActivation));

      const characteristic = accessory.service.getCharacteristic(EveCharacteristic(EveCharacteristicKey.LastActivation));
      characteristic.updateValue(lastActivation);

      characteristic.onGet(async (): Promise<Nullable<CharacteristicValue>> => {
        return accessory.getProperty(EveCharacteristicKey.LastActivation) ?? lastActivation;
      });

    }, 1 * SECOND);

    return historyService;
  }

  private getFilename(accessory: Accessory): string {
    return this.api.hap.uuid.generate(accessory.identifier + HISTORY_UUID);
  }

  private async cleanup(accessory: Accessory) {

    if (this.cleanedUp.has(accessory.identifier)) {
      return;
    }

    this.cleanedUp.add(accessory.identifier);

    const filename = this.getFilename(accessory);
    const filePath = path.join(this.persistPath, filename);

    const fileExists = await this.fileExists(filePath);
    if (!fileExists) {
      return;
    }

    this.log.ifDebug(strings.history.cleanup, accessory.name);

    try {
      await unlink(filePath);
    } catch (error) {

      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return;
      }

      this.log.error(strings.history.cleanupFailed, accessory.name, filename);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, F_OK);
      return true;
    } catch {
      return false;
    }
  }
}