import crypto from 'crypto';
import storage from 'node-persist';

import { PLATFORM_NAME, PLUGIN_NAME } from '../homebridge/settings.js';

export const STORAGE_KEY_USER_AUTH = 'auth';
export const STORAGE_KEY_RECOVERY_RATES = 'rates';

const STORAGE = new Map<string, string>();

export class Storage {

  public static async init(persistPath: string) {
    await storage.init({ dir: persistPath, forgiveParseErrors: true });
    await this.initLegacy();

    const storageJson = await storage.get(PLATFORM_NAME);
    if (storageJson === undefined) {
      return;
    }

    const storageArray = JSON.parse(storageJson) as [string, string][];
    for (const [key, value] of storageArray) {
      STORAGE.set(key, value);
    }
  }

  public static get(key: string, encryptionKey: string | undefined = undefined): string | undefined {
    let value = STORAGE.get(key);
    if (value !== undefined && encryptionKey !== undefined) {
      value = Storage.decrypt(value, encryptionKey);
    }
    return value;
  }

  public static set(key: string, value: string, encryptionKey: string | undefined = undefined) {

    if (encryptionKey !== undefined) {
      value = Storage.encrypt(value, encryptionKey);
    }

    if (STORAGE.get(key) === value) {
      return;
    }

    STORAGE.set(key, value);

    const storageArray = Array.from(STORAGE.entries());
    const storageJson = JSON.stringify(storageArray);
    storage.set(PLATFORM_NAME, storageJson);
  }

  private static async initLegacy() {

    const auth = await storage.get(`${PLUGIN_NAME}:${STORAGE_KEY_USER_AUTH}`);
    if (auth !== undefined) {
      Storage.set(STORAGE_KEY_USER_AUTH, auth);
      storage.removeItem(`${PLUGIN_NAME}:${STORAGE_KEY_USER_AUTH}`);
    }

    const recoveryRates = await storage.get(`${PLUGIN_NAME}:${STORAGE_KEY_RECOVERY_RATES}`);
    if (recoveryRates !== undefined) {
      Storage.set(STORAGE_KEY_RECOVERY_RATES, recoveryRates);
      storage.removeItem(`${PLUGIN_NAME}:${STORAGE_KEY_RECOVERY_RATES}`);
    }
  }

  private static digest(encryptionKey: string): Buffer {
    return crypto.createHash('sha256').update(encryptionKey).digest();
  }

  private static encrypt(serialized: string, encryptionKey: string) {
    const digest = Storage.digest(encryptionKey);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', digest, iv);
    const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private static decrypt(final: string, encryptionKey: string): string | undefined {

    try {
      const digest = Storage.digest(encryptionKey);
      const [ivHex, encryptedHex] = final.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', digest, iv);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');

      return decrypted;
      
    } catch {
      // nothing
    }
  }
}
