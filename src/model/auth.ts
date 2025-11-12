import { TokenData } from './types.js';

import { Storage, STORAGE_KEY_USER_AUTH } from '../tools/storage.js';

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
    const serialized = JSON.stringify({ data: this.data });
    Storage.set(STORAGE_KEY_USER_AUTH, serialized, encryptionKey);
  }

  static load(encryptionKey: string): Auth | undefined {

    const decrypted = Storage.get(STORAGE_KEY_USER_AUTH, encryptionKey);
    if (decrypted === undefined) {
      return;
    }

    const obj = JSON.parse(decrypted) as { data: TokenData };
    return new Auth(obj.data);
  }
}