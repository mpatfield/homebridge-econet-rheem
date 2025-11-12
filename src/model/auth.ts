import { TokenData } from './types.js';

import { Storage, LEGACY_STORAGE_KEY_AUTH, STORAGE_KEY_USER_AUTH } from '../tools/storage.js';

export class Auth {

  constructor(private readonly data: TokenData) {
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

  async save(encryptionKey: string): Promise<void> {

    try {
      const serialized = JSON.stringify({
        data: this.data,
      });

      Storage.set(STORAGE_KEY_USER_AUTH, serialized, encryptionKey);
  
    } catch {
      // nothing
    }
  }

  static load(encryptionKey: string): Auth | undefined {

    let decrypted = Storage.get(STORAGE_KEY_USER_AUTH, encryptionKey);
    if (decrypted === undefined) {

      decrypted = Storage.get(LEGACY_STORAGE_KEY_AUTH, encryptionKey);
      if (decrypted === undefined) {
        return;
      }

      Storage.set(STORAGE_KEY_USER_AUTH, decrypted, encryptionKey);
    }

    const obj = JSON.parse(decrypted) as { data: TokenData };
    return new Auth(obj.data);
  }
}