const en = {

  accessory: {
    alert: '%s has an alert', // device name
    badValue: '%s expected a %s for %s but received %s', // device name, value type, characteristic name, value
    outOfRange: '%s is trying to set %s to %s which is out of the allowed range. Setting to %s.', // device name, characteristic name, number, number
  },

  config: {

    continue: 'Continue %s', // arrow icon

    description: {
      account: 'Dedicated account recommended. See documentation.',
      devices: 'Providing additional device details gives a better experience. See documentation for details.',
      verbose: 'Enable additional debug logging',
    },

    needed: 'You will need your Rheem username and password',
    support: 'For documentation and support please visit %s', // url
    thankYou: 'Thank you for installing Homebridge Econet Rheem',

    title: {
      activeKey: 'Active Key',
      device: 'Device',
      devices: 'Devices',
      deviceName: 'Device Name',
      email: 'Email',
      password: 'Password',
      serialNumber: 'Serial Number',
      verbose: 'Verbose',
    },

  },

  equipment: {
    missingSerial: 'Equipment has missing serial number',
    unsupported: 'Unsupported equipment type: %s', // device name
  },

  general: {
    brand: 'EcoNet',
  },

  history: {
    entry: '%s logging history entry:', // device name
  },

  http: {
    authSuccess: 'Successfully authenticated',
    noDataReceived: 'No data received from EcoNet',
    reauthFailed: '%s failed to reauthenticate', // device name
    retryInMinutes: 'Request failed. Retrying in %d minutes…', // number
    retryInSeconds: 'Request failed. Retrying in %d seconds…', // number
  },

  mqtt: {
    connected: '%s connected and listening for updates', // device name
    disconnected: '%s disconnected', // device name
    error: '%s client error', // device name
    idleConnection: '%s connection is idle. Attempting to reconnect…', // device name
    new: '%s creating a new client with id %s', // device name, uuid
    notConnected: '%s not connected', // device name
    parseFailed: '%s failed to parse message', // device name
    reconnectMinutes: '%s will attempt to reconnect in %d minutes…', // device name, number
    reconnectSeconds: '%s will attempt to reconnect in %d seconds…', // device name, number
    reuse: '%s reusing existing client with id %s', // device name, uuid
    unstable: '%s connection is unstable. Attempting to reauthenticate…', // device name
  },

  waterHeater: {
    disabled: '%s is disabled', // device name
    disabledSet: 'Setting %s to disabled…', // device name
    idle: '%s is idle', // device name
    enabled: '%s is enabled', // device name
    enabledSet: 'Setting %s to enabled…', // device name
    running: '%s is heating', // device name
    temperatureCurrent: '%s temperature is %d°%s', // accessory name, number, units
    temperatureTarget: '%s target temperature is %d°%s', // accessory name, number, units
    temperatureTargetSet: '%s setting temperature to %d°%s…', // accessory name, number, units
  },

  startup: {
    badConfig: 'One or more required variables are missing from the config. Please check the documentation.',
    complete: '✓ Setup complete.',
    newEquipment: 'Adding new device:',
    noEquipment: 'No equipment found',
    removeDevice: 'Removing device:',
    restoringDevice: 'Restoring device:',
    welcome: [
      'Please ★ this plugin on GitHub if you\'re finding it useful! https://github.com/mpatfield/homebridge-econet-rheem',
      'Would you like to sponsor this plugin? https://github.com/sponsors/mpatfield',
      'Please rate us on HOOBS! https://plugins.hoobs.org/plugin/homebridge-econet-rheem',
      'Want to see this plugin in your own language? Please visit https://github.com/mpatfield/homebridge-econet-rheem/issues/35',
    ],
  },
};

export default en;