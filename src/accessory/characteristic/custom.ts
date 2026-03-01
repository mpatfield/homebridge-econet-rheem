import { Formats, Perms, Units, WithUUID } from 'homebridge';

import { strings } from '../../i18n/i18n.js';

import { CharacteristicKey, CustomCharacteristicKey } from '../../model/enums.js';
import { CharacteristicType } from '../../model/types.js';

let CustomCharacteristicKeys: Set<CustomCharacteristicKey> | undefined;
export function isCustomCharacteristic(key: CharacteristicKey): key is CustomCharacteristicKey {

  if (CustomCharacteristicKeys === undefined) {
    CustomCharacteristicKeys = new Set(Object.values(CustomCharacteristicKey));
  }

  return CustomCharacteristicKeys.has(key as CustomCharacteristicKey);
}

const CustomCharacteristics: Record<string, unknown> = {};
export function CustomCharacteristic(key: CustomCharacteristicKey, Characteristic: CharacteristicType) {

  if (CustomCharacteristics[key] === undefined) {

    const char = new Custom(key);

    CustomCharacteristics[key] = class extends Characteristic {
      constructor () {
        super(char.name, char.uuid, {
          format: Formats.UINT32,
          perms: [ Perms.PAIRED_READ, Perms.NOTIFY ],
          unit: char.units,
        });
        this.value = this.getDefaultValue();
      }
    };

    (CustomCharacteristics[key] as WithUUID<string>).UUID = char.uuid;
  }

  return CustomCharacteristics[key];
}

class Custom {

  constructor(private readonly key: CustomCharacteristicKey) {
  }

  get name(): string {
    switch (this.key) {
    case CustomCharacteristicKey.AlarmDescription:
      return '';
    case CustomCharacteristicKey.AmbientTemperature:
      return strings.characteristic.ambientTemperature;
    case CustomCharacteristicKey.HotWaterAvailable:
      return strings.characteristic.hotWaterAvailable;
    case CustomCharacteristicKey.RecoveryRate:
      return strings.characteristic.recoveryRate;
    }
  }

  get uuid(): string {
    switch (this.key) {
    case CustomCharacteristicKey.AlarmDescription:
      return '';
    case CustomCharacteristicKey.AmbientTemperature:
      return 'e9638ce8-19ad-468f-a4e8-a65042137a5f';
    case CustomCharacteristicKey.HotWaterAvailable:
      return 'f127b4a0-6d4b-48fd-8533-f5f4001152f2';
    case CustomCharacteristicKey.RecoveryRate:
      return '794fae1a-8f69-4c50-8b40-b135216f79dd';
    }
  }

  get units(): string {
    switch (this.key) {
    case CustomCharacteristicKey.AlarmDescription:
      return '';
    case CustomCharacteristicKey.AmbientTemperature:
      return Units.CELSIUS;
    case CustomCharacteristicKey.HotWaterAvailable:
      return '%';
    case CustomCharacteristicKey.RecoveryRate:
      return strings.characteristic.recoveryRateUnits;
    }
  }
}