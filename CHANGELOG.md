# Change Log

All notable changes to homebridge-econet-rheem will be documented in this file.

### HELP NEEDED!

Do you have a leak sensor and/or shut off valve on your water heater? I would like to add support for these but I don't have access. Please consider [getting involved](https://github.com/mpatfield/homebridge-econet-rheem/issues/4) if you'd like to see these features added.

## 1.5.10 (2025-05-28)

### Added

- Prettier settings

### Changed

- Updated dependencies

## 1.5.9 (2025-05-23)

### Fixed

- Some water heaters were not being set as enabled on startup

### Changed

- Updated dependencies

## 1.5.8 (2025-05-20)

### Added

- Display plugin version number in accessory info

### Fixed

- Fahrenheit conversion not working on some water heaters 

### Changed

- Updated various dependency libraries

## 1.5.7 (2025-05-18)

### Added

- Display plugin version number in accessory info

## 1.5.4 (2025-05-16)

### Added

- Prepare for HOOBS release

## 1.5.3 (2025-05-16)

### Added

- Show status fault indicator when device has an alert. Only displays in Eve and other advanced Home control apps.

## 1.4.9 (2025-05-16)

### Changed

- Water heater recovery simulator is now on by default. However, you can disable it in the plugin settings under "Advanced Settings." Disabling it will cause the current temperature to always match the set point.

## 1.4.6 (2025-05-15)

### Added

- Water heater recovery simulator since current temp is not supplied by the Econet API

### Changed

- Better reconnect logic and forced reauth when connection continually disconnects

## 1.1.4 (2025-05-08)

Is Celsius working for you? Please let me know by [opening a ticket](https://github.com/mpatfield/homebridge-econet-rheem/issues) so I can update the documentation.

### Added

- Support for Thermostats

## 1.0.8 (2025-04-28)

### Changed

- Improved retry logic to prevent stale connectios

### Fixed

- Crash on initalization of some water heaters

## 1.0.4 (2025-04-08)

### Added

- Homebridge verified plugin

## 1.0.2 (2025-04-08)

- Initial public release
