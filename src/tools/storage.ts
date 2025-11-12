import storage from 'node-persist';

import { PLUGIN_NAME } from '../homebridge/settings.js';

export const STORAGE_KEY_AUTH = 'auth';
export const STORAGE_KEY_MQTT = 'mqtt';
export const STORAGE_KEY_RECOVERY_RATES = 'rates';

export class Storage {

  public static async init(persistPath: string) {
    await storage.init({ dir: persistPath, forgiveParseErrors: true });
  }

  public static async get(key: string): Promise<string | null> {
    return await storage.get(`${PLUGIN_NAME}:${key}`);
  }

  public static async set(key: string, value: string): Promise<void> {
    storage.set(`${PLUGIN_NAME}:${key}`, value);
  }
}
