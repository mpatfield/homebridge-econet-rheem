<p align="center">
<img src="https://raw.githubusercontent.com/mpatfield/homebridge-econet-rheem/refs/heads/latest/img/banner.png" width="600">
</p>

<span align="center">

# homebridge-econet-rheem

Homebridge plugin for HomeKit control of Rheem water heaters and thermostats

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.com/channels/432663330281226270/1406798932188860496)\
[![npm](https://img.shields.io/npm/dw/homebridge-econet-rheem)](https://www.npmjs.com/package/homebridge-econet-rheem)
[![npm](https://img.shields.io/npm/dt/homebridge-econet-rheem)](https://www.npmjs.com/package/homebridge-econet-rheem)  

</span>

## Disclaimer

This plugin is independently developed and is not in any way affiliated with or endorsed by Rheem. Any issues or damage resulting from use of this plugin are not the fault of the developer. Use at your own risk.

It uses an unofficial EcoNet API and could stop working at any time without warning.

## Limitations

* Water Heaters
  * Switching modes is not possible, only enable/disable and adjusting desired temperature
* Celcius should work but is untested
  * *Let me know if you have successfully used ºC so I can remove this*

## Account Sharing

⚠️ It is recommended to use a dedicated account for use with Homebridge.

This is because Rheem only allows one device to be subscribed to real-time updates, so if you open the Rheem app then the Homebridge plugin will silently stop receiving updates.

The plugin will eventually resubscribe after being idle for an extended period, but you could miss updates in the meantime. Using a separate account will avoid this issue.

To get started, visit "Account Sharing" in the Rheem app menu.

## Device Details

TODO

  Only tested with Heat Pump Water Heater

  * Current temperature is not supported by the API so recovery temperature is simulated

    https://community.hubitat.com/t/rheem-econet-integration-maintained-by-kris-linquist/116913/72

    To obtain these credentials, connect to your water heater's wifi and go to https://192.168.10.1/cred

    1.	Put it in Wi-Fi setup mode
    •	On most Rheem EcoNet controllers, press and hold the Wi-Fi or Settings → Wi-Fi Setup option until the screen shows “Ready to Connect.”
    •	The heater will broadcast an EcoNet-XXXX network.
    2.	Connect to that network
    •	Use your phone/laptop to join the EcoNet network.
    •	Retrieve any info you need (e.g., by visiting 192.168.10.1).
    3.	Reconnect it to your home network
    •	Open the Rheem EcoNet app.
    •	Choose Add Device → Water Heater → Connect to Wi-Fi → select your home SSID and enter your Wi-Fi password.
    •	Wait until the heater display says “Connected.”

## Configuration

Using the Homebridge Config UI is the easiest way to set up this plugin. However, if you wish to do things manually then you will need to add the following to your Homebridge `config.json`:

   ```json
   {
     "platforms": [
       {
         "platform": "HomebridgeEconetRheem",
         "email": "your_econet_email",
         "password": "your_econet_password",
         "wh_sim_disable": false,
         "verbose": false
       }
     ]
   }
   ```

- `platform`: (Required) Must be "HomebridgeEconetRheem".
- `email`: (Required) Your Econet account email.
- `password`: (Required) Your Econet account password.
- `wh_sim_disable`: (Optional) Set to `true` to disable and use set_point as the current temperature.
- `verbose`: (Optional) Set to `true` to enable additional debug logging. Default is `false`.

## Contributing

Ideas and bug reports are welcome. To assist:

1. Turn on "Verbose" logging in the plugin config under "Advanced Settings"
2. Run Homebridge in debug mode

   ```
   Homebridge Settings -> Startup & Environment -> Homebridge Debug Mode -D
   ```

3. Capture the JSON responses in the Logs for HTTP and MQTT state changes
4. Submit the captured data via a GitHub [issue](https://github.com/mpatfield/homebridge-econet-rheem/issues/new/choose) or [pull request](https://github.com/mpatfield/homebridge-econet-rheem/pulls).

Your contributions will help enhance the plugin's functionality and device support.

## Credits

[@w1ll1am23](https://github.com/sponsors/w1ll1am23) for earlier work done in [pyeconet](https://github.com/w1ll1am23/pyeconet), a Python 3 interface to the EcoNet API

[@klinquist](https://github.com/sponsors/klinquist) for his comment [here](https://community.hubitat.com/t/rheem-econet-integration-maintained-by-kris-linquist/116913/72) which lead to [better realtime updates](#device-details)

[@r3tr3ad](https://github.com/r3tr3ad) for helping debug the thermostat implementation.

[Keryan Belahcene](https://www.instagram.com/keryan.me) for creating the [Flume](https://github.com/homebridge-plugins/homebridge-flume) header logo which I adapted for this plugin

And to the amazing creators/contributors of [Homebridge](https://homebridge.io) who made this plugin possible!
