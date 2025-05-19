# Change Log

All notable changes to homebridge-econet-rheem will be documented in this file.

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

### Fixed

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
