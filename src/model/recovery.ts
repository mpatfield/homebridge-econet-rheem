import { Properties } from '../tools/properties.js';
import { HOUR } from '../tools/time.js';

type TemperatureEntry = { temperature: number, timestamp: number }

const MAX_RATES = 12;

export class RecoveryRates {

  private lastEntry?: TemperatureEntry;
  private rates: number[];

  constructor(private readonly identifier: string) {
    this.rates = Properties.get(identifier, RecoveryRates.name) as number[] ?? [];
  }

  public recordTemperature(temperature: number) {
    
    const currentEntry = { temperature, timestamp: Date.now() };
    if (this.lastEntry !== undefined && currentEntry.temperature > this.lastEntry.temperature) {

      const deltaTemp = currentEntry.temperature - this.lastEntry.temperature;
      const deltaTime = currentEntry.timestamp - this.lastEntry.timestamp;

      const rate = (deltaTemp / deltaTime) * HOUR;

      this.rates.push(rate);
      if (this.rates.length > MAX_RATES) {
        const first = this.rates.shift()!;
        const second = this.rates.shift()!;
        this.rates.unshift( (first + second) / 2);
      }

      Properties.set(this.identifier, RecoveryRates.name, this.rates);
    }

    this.lastEntry = currentEntry;
  }

  public getAverage(): number {

    if (this.rates.length === 0) {
      return 0;
    }

    const sum = this.rates.reduce( (previous, current) => current + previous);
    return sum / this.rates.length;
  }
}