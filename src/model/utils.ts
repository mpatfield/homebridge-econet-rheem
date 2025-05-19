import fs from 'fs';
import path from 'path';

import { TemperatureUnits } from '../model/enums.js';
import { fileURLToPath } from 'url';

export const SECOND = 1000;
export const MINUTE = 60000;
export const HOUR = 3600000;

const fahrenheitToCelsius = (fahrenheit: number): number => {
  return Number(((fahrenheit - 32) * 5 / 9).toFixed(1));
};

const celsiusToFahrenheit = (celsius: number): number => {
  return Math.round((celsius * 9 / 5) + 32);
};

export const toCelsius = (temp: number, units: TemperatureUnits): number => {
  return units === TemperatureUnits.FAHRENHEIT ? fahrenheitToCelsius(temp) : temp;
};

export const fromCelsius = (temp: number, units: TemperatureUnits): number => {
  return units === TemperatureUnits.FAHRENHEIT ? celsiusToFahrenheit(temp) : temp;
};

 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPackageJson(): any {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packageJSONPath = path.join(__dirname, '../../package.json');
  return JSON.parse(fs.readFileSync(packageJSONPath, { encoding: 'utf8' }));
}

export default function getVersion(): string {
  try {
    return loadPackageJson().version;
  } catch (error) {
    return '0.0.0'; 
  }
}

function readStorage(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

function writeStorage(filePath: string, storage: Record<string, string>): void {
  fs.writeFileSync(filePath, JSON.stringify(storage, null, 2));
}

export function safeGetItem(filePath: string, key: string): string | null {
  const storage = readStorage(filePath);
  return storage[key] ?? null;
}

export function safeSetItem(filePath: string, key: string, value: string): void {
  const storage = readStorage(filePath);
  storage[key] = value;
  writeStorage(filePath, storage);
}