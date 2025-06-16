import storage from 'node-persist';

export const STORAGE_KEY_AUTH = 'auth';
export const STORAGE_KEY_MQTT = 'mqtt';
export const STORAGE_KEY_RECOVERY_RATES = 'rates';

async function init(dir: string) {
  await storage.init({ dir: dir, forgiveParseErrors: true });
}

export async function storageGet(dir: string, key: string): Promise<string | null> {
  try {
    await init(dir);
    return await storage.get(key);
  } catch (err) {
    return null;
  }
}

export async function storageSet(dir: string, key: string, value: string): Promise<void> {
  try {
    await init(dir);
    storage.set(key, value);
  } catch {
    // Nothing
  }
}
