import crypto from 'crypto';

import { TokenData } from './types.js';

import { storageGet, storageSet, STORAGE_KEY_AUTH } from '../tools/storage.js';

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

  async save(filePath: string, encryptionKey: string): Promise<void> {

    try {
      const serailzed = JSON.stringify({
        data: this.data,
      });

      const digest = Auth.digest(encryptionKey);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', digest, iv);
      const encrypted = Buffer.concat([cipher.update(serailzed, 'utf8'), cipher.final()]);
      const final = iv.toString('hex') + ':' + encrypted.toString('hex');

      await storageSet(filePath, STORAGE_KEY_AUTH, final);
    } catch (err) {
      // Nothing
    }
  }

  static async load(filePath: string, encryptionKey: string): Promise<Auth | null> {

    try {

      const final = await storageGet(filePath, STORAGE_KEY_AUTH);
      if (!final) {
        return null;
      }

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