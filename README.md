<p align="center">
<img src="https://raw.githubusercontent.com/mpatfield/homebridge-econet-rheem/refs/heads/latest/img/banner.png" width="600">
</p>

<span align="center">

# Homebridge Econet Rheem

Homebridge plugin for HomeKit control of Rheem water heaters and thermostats

[![verified-by-homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=flat)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/QNErYXzS)\
[![npm](https://img.shields.io/npm/dw/homebridge-econet-rheem)](https://www.npmjs.com/package/homebridge-econet-rheem)
[![npm](https://img.shields.io/npm/dt/homebridge-econet-rheem)](https://www.npmjs.com/package/homebridge-econet-rheem)  

</span>

## Disclaimer

Homebridge Econet Rheem is independently developed and is not in any way affiliated with or endorsed by Rheem. Any issues or damage resulting from use of this plugin are not the fault of the developer. Use at your own risk.

This plugin uses an unofficial EcoNet API and could stop working at any time without warning.

## Known Limitations

* Water Heaters
  * Switching modes is not possible, only enable/disable and adjusting desired temperature
* Celcius should work but is untested
  * *Please let me know if you have successfully used ºC by [creating a ticket](https://github.com/mpatfield/homebridge-econet-rheem/issues/new/choose) so I can remove this*

## Account Sharing

⚠️ It is recommended to use a dedicated account for use with Homebridge.

Rheem only allows one device to be subscribed to real-time updates, so if you open the Rheem app then the Homebridge plugin will silently stop receiving updates.

The plugin will eventually resubscribe after being idle for an extended period, but you could miss updates in the meantime. Using a separate account will avoid this issue.

To get started, visit "Account Sharing" in the Rheem app menu.

## Configuration

Using the Homebridge Config UI is the easiest way to set up this plugin. However, if you wish to do things manually then you will need to add the following to your Homebridge `config.json`:

```json
{
  "name": "Econet Rheem",
  "email": "string",
  "password": "string",
  "devices": [
      {
          "serialNumber": "string",
          "deviceName": "string",
          "activeKey": "string"
      }
      ...
  ],
  "verbose": false,
  "platform": "HomebridgeEconetRheem"
}
```

- `platform`: (Required) Must be "HomebridgeEconetRheem"
- `email`: (Required) Your Econet account email
- `password`: (Required) Your Econet account password
- `verbose`: (Optional) Set to `true` to enable additional debug logging. Default is `false`

## Device Details

⚠️ This has only been confirmed with a 2024 Heat Pump Water Heater (XE65T10HM00U0). It will not work with water heaters using the Home Comfort WiFi Module. You are welcome to try other equipment, but you may run into issues. If you do, please [open a ticket](https://github.com/mpatfield/homebridge-econet-rheem/issues/new/choose) and we can work together to try and support your equipment.

While optional, providing additional details about your device gives more accurate real-time info, such as true current water temperature for water heaters. However, it does require collecting additional info about your device: `serialNumber`, `deviceName`, and `activeKey`.

The easiest way to get the `serialNumber` is by visiting [this site](https://mpatfield.github.io/homebridge-econet-rheem/serials.html). Enter your Econet username and password and it'll give you a list of serial numbers.

```json
{
  "name": "My Water Heater",
  "serial_number": "00-11-22-33-44-aa-bb-cc-dd" <-- THIS IS YOUR SERIAL NUMBER
}
```

For `deviceName` and `activeKey`, you will need to connect to your devices WiFi.

1. Put your equipment in WiFi setup mode — for most controllers, press and hold the WiFi button
2. Connect to the WiFi network (e.g. *EcoNet-XXXX*)
3. Visit https://192.168.10.1/cred and you should see something like the following:

```json
{
  "SYSTEM-KEY":"e2e699cb0bb0bbb88fc8858cb5a401",
  "SYSTEM-SECRET":"E2E699CB0BE6C6FADDB1B0BC9A20",
  "ACTIVE-KEY":"0123456789abcdef", <-- THIS IS YOUR ACTIVE KEY
  "DEVICE-NAME":"fedcba9876543210", <-- THIS IS YOUR DEVICE NAME
  "IDENTITY":"13577054-594d-48a3-b02a-e49ed0af8f5e",
  "AUTH_URL":"rheem.clearblade.com",
  "CLOUDURL":"rheem.clearblade.com",
  "SAUTHPOR":8906,
  "SCLODPOR":1884
}
```

4. Copy and paste the pieces you need
5. Reconnect your device to your WiFi network by opening the Rheem app and choosing "Add Product"

Enter the `serialNumber`, `deviceName`, and `activeKey` you collected from above in the Homebridge Econet Rheem config UI and restart Homebridge. You should now see more accurate real-time information in the Home app!

## Credits

[@w1ll1am23](https://github.com/sponsors/w1ll1am23) for earlier work done in [pyeconet](https://github.com/w1ll1am23/pyeconet), a Python 3 interface to the EcoNet API

[@klinquist](https://github.com/sponsors/klinquist) for his comment [here](https://community.hubitat.com/t/rheem-econet-integration-maintained-by-kris-linquist/116913/72) which inspired [better realtime updates](#device-details)

[fakegato-history](https://github.com/simont77/fakegato-history) by [@simont77](https://github.com/sponsors/simont77) *Copyright © 2017*

[@r3tr3ad](https://github.com/r3tr3ad) for helping debug the thermostat implementation.

[Keryan Belahcene](https://www.instagram.com/keryan.me) for creating the [Flume](https://github.com/homebridge-plugins/homebridge-flume) header logo which I adapted for this plugin

And to the amazing creators/contributors of [Homebridge](https://homebridge.io) who made this plugin possible!
