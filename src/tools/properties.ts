import crypto from 'crypto';
import { PrimitiveTypes } from 'homebridge';
import storage from 'node-persist';

import { Mutex } from './mutex.js';

import { PLATFORM_NAME } from '../homebridge/settings.js';

const VERSION = 2;
const STORAGE_KEY = `${PLATFORM_NAME}_V${VERSION}`;

type Storable = PrimitiveTypes | PrimitiveTypes[] | { [key: string]: PrimitiveTypes };
const PROPERTIES = new Map<string, Map<string, Storable>>();

const MUTEX = new Mutex();

export class Properties {

  public static async initStorage(persistPath: string) {
    await storage.init({ dir: persistPath, forgiveParseErrors: true });

    const storageJson = await storage.get(STORAGE_KEY);
    if (storageJson === undefined) {
      Properties.save();
      return;
    }

    try {
      const storageArray = JSON.parse(storageJson) as [string, [string, Storable][]][];
      for (const [identifier, itemsArray] of storageArray) {
        const itemsMap = new Map<string, Storable>(itemsArray);
        PROPERTIES.set(identifier, itemsMap);
      }
    } catch {
    // ignore
    }
  }

  public static get(identifier: string, key: string, encryptionKey?: string): Storable | undefined {
    let value = PROPERTIES.get(identifier)?.get(key);
    if (value !== undefined && encryptionKey !== undefined && typeof value === 'string') {
      value = Properties.decrypt(value, encryptionKey);
    }
    return value;
  }

  public static async set(identifier: string, key: string, item: Storable | undefined, encryptionKey?: string) {

    if (encryptionKey !== undefined && typeof item === 'string') {
      item = Properties.encrypt(item, encryptionKey);
    }
    
    const items = PROPERTIES.get(identifier) || new Map();

    if (items.get(key) === item) {
      return;
    }

    if (item !== undefined) {
      items.set(key, item);
    } else {
      items.delete(key);
    }

    PROPERTIES.set(identifier, items);

    Properties.save();
  }

  private static async save() {
    await MUTEX.lock(async () => {
      await Properties._save();
    });
  }

  private static async _save() {
    const storageArray = Array.from(PROPERTIES.entries()).map(([key, value]) => {
      return [key, Array.from(value.entries())];
    });

    const storageJson = JSON.stringify(storageArray);
    await storage.set(STORAGE_KEY, storageJson);
  }

  private static digest(encryptionKey: string): Buffer {
    return crypto.createHash('sha256').update(encryptionKey).digest();
  }

  private static encrypt(serialized: string, encryptionKey: string) {
    const digest = Properties.digest(encryptionKey);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', digest, iv);
    const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private static decrypt(final: string, encryptionKey: string): string | undefined {

    try {
      const digest = Properties.digest(encryptionKey);
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