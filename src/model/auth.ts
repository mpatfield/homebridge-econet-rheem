import { DeviceTokenData, UserTokenData } from './types.js';

import { Storage, STORAGE_KEY_USER_AUTH } from '../tools/storage.js';

export class UserAuth {

  constructor(private readonly data: UserTokenData) {
  }

  get token(): string {
    return this.data.user_token;
  }

  get userId(): string {
    return this.data.user_id;
  }

  get accountId(): string {
    return this.data.options.account_id;
  }

  save(encryptionKey: string) {
    const serialized = JSON.stringify({ data: this.data });
    Storage.set(STORAGE_KEY_USER_AUTH, serialized, encryptionKey);
  }

  static load(encryptionKey: string): UserAuth | undefined {

    const decrypted = Storage.get(STORAGE_KEY_USER_AUTH, encryptionKey);
    if (decrypted === undefined) {
      return;
    }

    const obj = JSON.parse(decrypted) as { data: UserTokenData };
    return new UserAuth(obj.data);
  }
}

export class DeviceAuth {

  static cache = new Map<string, DeviceAuth>();

  private constructor(private readonly data: DeviceTokenData) {
  }

  get name(): string {
    return this.data.deviceName;
  }

  get token(): string {
    return this.data.deviceToken;
  }

  static save(serialNumber: string, data: DeviceTokenData, encryptionKey: string) {
    const serialized = JSON.stringify({ data });
    Storage.set(serialNumber, serialized, encryptionKey);

    DeviceAuth.cache.set(serialNumber, new DeviceAuth(data));
  }

  static load(serialNumber: string, encryptionKey: string): DeviceAuth | undefined {

    if (!this.cache.has(serialNumber)) {
      
      const decrypted = Storage.get(serialNumber, encryptionKey);
      if (decrypted === undefined) {
        return;
      }

      const obj = JSON.parse(decrypted) as { data: DeviceTokenData };
      this.cache.set(serialNumber, new DeviceAuth(obj.data));
    }

    return this.cache.get(serialNumber);
  }
}