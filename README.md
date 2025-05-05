<p align="center">
<img src="https://github.com/mpatfield/homebridge-econet-rheem/blob/latest/icon.png" width="100">
</p>

# Homebridge EcoNet Rheem Plugin

This Homebridge plugin integrates Rheem EcoNet devices into Apple HomeKit.

> [!NOTE]
> This plugin uses an unofficial EcoNet API and could stop working at any time without warning.

## Limitations

* Due to limitations in HomeKit, it is not possible to switch water heater modes, only enable/disable and adjust the desired temperature.
* I do not have access to a thermostat, so that functionality may be buggy
  * *Please run in debug/verbose mode included the generated json output when creating an issue*
* Celcius should work but is untested
  * *Let me know if you have successfully used ºC so I can remove this*

## Installation

1. Ensure you have [Homebridge](https://homebridge.io) installed and running.
2. Install this plugin via npm:

   ```bash
   npm install -g homebridge-econet-rheem
   ```

## Configuration

Add the following to your Homebridge `config.json`:

   ```json
   {
     "platforms": [
       {
         "platform": "HomebridgeEconetRheem",
         "email": "your_econet_email",
         "password": "your_econet_password",
         "verbose": false
       }
     ]
   }
   ```

- `platform`: (Required) Must be "HomebridgeEconetRheem".
- `email`: (Required) Your Econet account email.
- `password`: (Required) Your Econet account password.
- `verbose`: (Optional) Set to `true` to enable additional debug logging. Default is `false`.

## Contributing

Contributions to support Thermostat operation are welcome. To assist:

1. Set `"verbose": true` in the plugin configuration.
2. Run Homebridge in debug mode:

   ```bash
   homebridge -D
   ```

3. Capture the JSON responses for HTTP and MQTT state changes.
4. Submit the captured data via a GitHub issue or pull request.

Your contributions will help enhance the plugin's functionality and device support.

## Disclaimer

This plugin is independently developed and is not in any way affiliated with or endorsed by Rheem.

## Credits

Econet API leans heavily on earlier work done by [@w1ll1am23](https://github.com/sponsors/w1ll1am23) in [pyeconet](https://github.com/w1ll1am23/pyeconet), a Python 3 interface to the EcoNet API.

Special thanks to [@r3tr3ad](https://github.com/r3tr3ad) for helping debug the thermostat implementation.