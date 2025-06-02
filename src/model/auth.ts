import crypto from 'crypto';

import { TokenData } from './types.js';

import { safeGetItem, safeSetItem, STORAGE_KEY_AUTH } from '../tools/storage.js';

export class Auth {

  constructor(
    private readonly data: TokenData,
  ){}

  get token(): string {
    return this.data.user_token;
  }

  get userId(): string {
    return this.data.user_id;
  }

  get accountId(): string {
    return this.data.options.account_id;
  }

  private static digest(encryptionKey: string): Buffer {
    return crypto.createHash('sha256').update(encryptionKey).digest();
  }

  save(filePath: string, encryptionKey: string): void {

    const serailzed = JSON.stringify({
      data: this.data,
    });

    const digest = Auth.digest(encryptionKey);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', digest, iv);
    const encrypted = Buffer.concat([cipher.update(serailzed, 'utf8'), cipher.final()]);
    const final = iv.toString('hex') + ':' + encrypted.toString('hex');

    safeSetItem(filePath, STORAGE_KEY_AUTH, final);
  }

  static load(filePath: string, encryptionKey: string): Auth | null {

    const final = safeGetItem(filePath, STORAGE_KEY_AUTH);
    if (!final) {
      return null;
    }

    try {

      const digest = Auth.digest(encryptionKey);
      const [ivHex, encryptedHex] = final.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', digest, iv);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');

      const obj = JSON.parse(decrypted) as { data: TokenData, created: number };
      return new Auth(obj.data);
      
    } catch {
      return null;
    }
  }
}