const en = {

  accessory: {
    alert: '%s has an alert', // device name
    badValue: '%s expected a %s for %s but received %s', // device name, value type, characteristic name, value
    outOfRange: '%s is trying to set %s to %s which is out of the allowed range. Setting to %s.', // device name, characteristic name, number, number
  },

  characteristic: {
    ambientTemperature: 'Ambient Temperature',
    hotWaterAvailable: 'Hot Water',
    recoveryRate: 'Recovery Rate',
    recoveryRateUnits: '° per hour',
  },

  config: {

    continue: 'Continue %s', // arrow icon

    description: {
      account: 'Dedicated account recommended. See documentation.',
      devices: 'Providing additional device details gives a better experience. See documentation for details.',
    },

    needed: 'You will need your Rheem username and password',
    support: 'For documentation and support please visit %s', // url
    thankYou: 'Thank you for installing Homebridge Econet Rheem',

    title: {
      activeKey: 'Active Key',
      device: 'Device',
      devices: 'Devices',
      deviceName: 'Device Name',
      disableLogging: 'Disable Logging',
      email: 'Email',
      enableHistory: 'Enable History',
      password: 'Password',
      serialNumber: 'Serial Number',
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
    cleanup: 'Removing history for %s', // device name
    cleanupFailed: 'Unable to remove history for %s. Try manually removing the file %s from your Homebridge \'persist\' directory.', // device name, filename
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
    currentConsumption: '%s consumption is %dW', // accessory name, value
    disabled: '%s is disabled', // device name
    disabledSet: 'Setting %s to disabled…', // device name
    idle: '%s is idle', // device name
    enabled: '%s is enabled', // device name
    enabledSet: 'Setting %s to enabled…', // device name
    running: '%s is heating', // device name
    totalConsumption: '%s consumption is %dkWh', // accessory name, value
  },

  temperatureControl: {
    current: '%s temperature is %d°%s', // accessory name, number, units
    target: '%s target temperature is %d°%s', // accessory name, number, units
    targetSet: 'Setting %s temperature to %d°%s…', // accessory name, number, units
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
      'Want to see this plugin in your own language? Please visit https://github.com/mpatfield/homebridge-econet-rheem/issues/35',
    ],
  },

  thermostat: {
    humidity: '%s humidity is %d%', // device name
    stateAutoFuture: 'Settings %s to Auto…', // device name
    stateCool: '%s set to Cool', // device name
    stateCoolFuture: 'Settings %s to Cool…', // device name
    stateHeat: '%s set to Heat', // device name
    stateHeatFuture: 'Settings %s to Heat…', // device name
    stateOff: '%s set to Off', // device name
    stateOffFuture: 'Settings %s to Off…', // device name
    targetSetFailed: '%s unabled to set target with value %s', // device name, value
  },
};

export default en;