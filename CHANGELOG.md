# Change Log

All notable changes to homebridge-econet-rheem will be documented in this file.

## 1.7.11-beta. ()

### Changed
- ⚠️ Dropped [official support](https://github.com/homebridge/homebridge/wiki/How-To-Update-Node.js) for Node.js v20 and added Node.js v26

### Notes
Please consider giving this plugin a ⭐️ on [GitHub](https://github.com/mpatfield/homebridge-econet-rheem) if you're finding it useful!

## 1.7.10 (2026-06-26)

### Fixed
- Embed clearblade certs to fix "unable to get local issuer certificate" errors

### Changed
- Updated dependencies

## 1.7.9

### Changed
- Updated dependencies

## 1.7.8 (2026-05-30)

### Fixed
- Potential race condition in persistent storage
- Possible crash on load

### Changed
- Updated dependencies

## 1.7.7 (2026-05-12)

### Fixed
- Potential crash in translation system

### Changed
- Removed `beta` tag from `homebridge` dependency
- Reduced noisy startup logging
- Updated dependencies

### Notes
Would you like to see Homebridge Econet Rheem in your language? Please consider [getting involved](https://github.com/mpatfield/homebridge-econet-rheem/issues/35). No coding experience required!

## 1.7.6 (2026-04-21)

### Changed
- Reduced MQTT `keepalive` to fix ECONNRESET errors caused by CGNAT
- Updated dependencies

## 1.7.5 (2026-03-30)

### Changed
- Cleanup unnecessary dependencies
- npm audit fix

## 1.7.4 (2026-03-24)

### Changed
- Updated dependencies and fixed npm audit vulnerabilities


## 1.7.3 (2026-03-04)

### Fixed
- Incorrect hot water characteristic ([Eve App](https://github.com/mpatfield/homebridge-econet-rheem/wiki/Eve-App-Support))

### Changed
- Updated dependencies

## 1.7.2 (2026-02-18)

### Added
- Additional [Eve App](https://github.com/mpatfield/homebridge-econet-rheem/wiki/Eve-App-Support) Characteristics — Ambient Temperature, Hot Water Availability, Recovery Rate

## 1.7.1 (2026-02-10)

### Fixed
- Several issues with Thermostats

### Changed
- Config UI schemas are generated at build-time rather than translated at run-time ([open a ticket](https://github.com/mpatfield/homebridge-econet-rheem/issues/new/choose) if you have issues)
- Updated mqtt and axios dependencies

## 1.7.0 (2026-01-25)

### Changed
- Complete rewrite of Econet real-time communication model (MQTT) for easier updates and maintenance
    - ⚠️ I am unable to test Thermostat so please [create a ticket](https://github.com/mpatfield/homebridge-econet-rheem/issues/new/choose) if you notice issues
- More granular logging control — use "Disable Logging" option to turn off logging

### Added
- [Eve App Support](https://github.com/mpatfield/homebridge-econet-rheem/wiki/Eve-App-Support) for temperature/humidity history and current/total consumption characteristics — choose "Enable History" in the config UI

### Fixed
- Checkboxes in config UI not reflecting correct state in ([#150](https://github.com/mpatfield/homebridge-econet-rheem/issues/150))

## 1.6.2 (2026-01-16)

### ⚠️ Help Needed ⚠️
Please help test Homebridge Econet Rheem beta! While there are no new features (yet), it is a complete rewrite of the underlying code, which will be easier to expand and maintain. In particular, I have no ability to test `Thermostats` so please give it a try and let me know if you see issues by [creating a ticket](https://github.com/mpatfield/homebridge-econet-rheem/issues/new/choose). You can always downgrade to v1.6.2 if it isn't working for you.

### Fixed
- Bad email/password can cause users to get stuck even after correcting login credentials ([#141](https://github.com/mpatfield/homebridge-econet-rheem/issues/141))

## 1.6.1 (2025-12-15)

### Changed
- Use device topics for publish when possible

## 1.6.0 (2025-11-24)

### Added
- Real-time current temperature for water heaters ([see documentation](https://github.com/mpatfield/homebridge-econet-rheem#device-details))

### Changed
- Consolidated persistent storage into a single file
- Water heater recovery simulator removed in favor of real-time updates above
- Updated dependencies

## 1.5.19 (2025-11-01)

### Fixed
- Minor issues with Friedrich devices

### Changed
- ⚠️ Dropped [official support](https://github.com/homebridge/homebridge/wiki/How-To-Update-Node.js) for Node.js v18 and added Node.js v24
- Updated dependencies

## 1.5.18 (2025-10-21)

### Changed
- Updated dependencies

## 1.5.17 (2025-09-24)

### Changed
- Updated dependencies

## 1.5.16 (2025-08-26)

### Fixed
- Devices could be unnecessarily removed on startup if device fetch fails

### Changed
- Update dependencies

## 1.5.15 (2025-08-11)

### Fixed
- Broken header image in config UI

### Changed
- Update dependencies

## 1.5.14 (2025-07-14)

### Fixed
- Config UI styles in dark mode

### Changed
- Force ui.js cache miss in config ui on each new version
- Update dependencies

## 1.5.13 (2025-06-25)

### Changed
- Dynamic translations
- Use node-persist for auth token caching

## 1.5.12 (2025-06-04)

While there are no new features in this release, significant portions of the code have been rewritten and modernized. This will make it much easier to maintain and improve this plugin going forward.

### Changed
- Major rewrite of the Rheem connection module for improved stability and recovery
- Store auth locally to reduce calls to login endpoint
- Added http retry mechanism
- Quieter logs when plugin is able to self-correct
- Move strings into centralized place to allow for translations
- Redact potentially sensitive information in logs

### Fixed
- Fix for characteristic error on first launch

## 1.5.11 (2025-05-28)

### Fixed
- Broken settings

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
