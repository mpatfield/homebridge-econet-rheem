import { UserTokenData } from './types.js';

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