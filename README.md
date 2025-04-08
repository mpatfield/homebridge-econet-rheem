<p align="center">
<img src="https://github.com/mpatfield/homebridge-econet-rheem/blob/latest/icon.png" width="100">
</p>

# Homebridge EcoNet Rheem Plugin

This Homebridge plugin integrates Rheem EcoNet-enabled devices into Apple HomeKit. **Currently, only Water Heaters have been fully implemented and tested.** Thermostat support and Celsius operation remain untested.

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
         "debug": false
       }
     ]
   }
   ```

- `platform`: (Required) Must be "HomebridgeEconetRheem".
- `email`: (Required) Your Econet account email.
- `password`: (Required) Your Econet account password.
- `debug`: (Optional) Set to `true` to enable debug logging. Default is `false`.

## Current Limitations

- **Water Heaters**: Fully implemented and tested in Farenheit.
- **Thermostats**: Not implemented or tested due to lack of hardware access.
- **Celsius Operation**: Untested.

## Contributing

Contributions to support Thermostat operation are welcome. To assist:

1. Set `"debug": true` in the plugin configuration.
2. Run Homebridge in debug mode:

   ```bash
   homebridge -D
   ```

3. Capture the JSON responses for HTTP and MQTT state changes.
4. Submit the captured data via a GitHub issue or pull request.

Your contributions will help enhance the plugin's functionality and device support.

## Disclaimer

This plugin is independently developed and is not affiliated with or endorsed by Rheem Manufacturing Company.
