import { DeviceTokenData, UserTokenData } from './types.js';

import { Properties } from '../tools/properties.js';

const USER_AUTH_IDENTIFIER = 'e7764cce33fe4f9baa6fb6ffec909bca';

export enum AuthType {
  DEVICE,
  USER,
}

abstract class Auth {
  constructor(public readonly type: AuthType) {}
}

export class UserAuth extends Auth {

  constructor(private readonly data: UserTokenData) {
    super(AuthType.USER);
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
    Properties.set(USER_AUTH_IDENTIFIER, UserAuth.name, serialized, encryptionKey);
  }

  static load(encryptionKey: string): UserAuth | undefined {

    const decrypted = Properties.get(USER_AUTH_IDENTIFIER, UserAuth.name, encryptionKey);
    if (decrypted === undefined || typeof decrypted !== 'string') {
      return;
    }

    const obj = JSON.parse(decrypted) as { data: UserTokenData };
    return new UserAuth(obj.data);
  }
}

export class DeviceAuth extends Auth {

  static cache = new Map<string, DeviceAuth>();

  private constructor(private readonly data: DeviceTokenData) {
    super(AuthType.DEVICE);
  }

  get name(): string {
    return this.data.deviceName;
  }

  get token(): string {
    return this.data.deviceToken;
  }

  static save(serialNumber: string, data: DeviceTokenData, encryptionKey: string) {
    const serialized = JSON.stringify({ data });
    Properties.set(serialNumber, DeviceAuth.name, serialized, encryptionKey);

    DeviceAuth.cache.set(serialNumber, new DeviceAuth(data));
  }

  static load(serialNumber: string, encryptionKey: string): DeviceAuth | undefined {

    if (!this.cache.has(serialNumber)) {
      
      const decrypted = Properties.get(serialNumber, DeviceAuth.name, encryptionKey);
      if (decrypted === undefined || typeof decrypted !== 'string') {
        return;
      }

      const obj = JSON.parse(decrypted) as { data: DeviceTokenData };
      this.cache.set(serialNumber, new DeviceAuth(obj.data));
    }

    return this.cache.get(serialNumber);
  }
}