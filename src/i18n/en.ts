const en = {

  accessory: {
    badType: '%s config variable %s should have type %s but was %s', // accessory name, variable name, type, type
    missingRequired: '%s is missing required config variable %s', // accessory name, variable name
  },

  config: {
    continue: 'Continue %s',

    description: {
      account: 'Dedicated account recommended. See documentation.',
      devices: 'Providing additional device details gives a better experience. See documentation for details.',
      verbose: 'Enable additional debug logging',
    },

    needed: 'You will need your Rheem username and password',
    support: 'For documentation and support please visit %s',
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

  debug: {
    alertCount: '%s alert count = %s',
    availabilityState: '%s availability = %s',
    clientOffline: 'Client offline',
    coolSetpoint: '%s cool setpoint = %s',
    currentTempState: '%s current temp = %s',
    enabledState: '%s enabled = %s',
    heatSetpoint: '%s heat setpoint = %s',
    humidityState: '%s humidity = %s',
    modeState: '%s mode = %s',
    runningState: '%s running = %s',
    setpointState: '%s setpoint = %s',
  },

  equipment: {
    outOfRangeCool: 'Cool setpoint out of range, lower: %s, upper: %s, setpoint: %s',
    outOfRangeHeat: 'Heat setpoint out of range, lower: %s, upper: %s, setpoint: %s',
    setpointUnknown: 'Cannot determine desired setpoint when mode is %s',
    thermostat: 'Thermostat',
    unknownMode: 'Unknown thermostat mode:',
    unsupported: 'Unsupported equipment type: %s',
    unsupportedState: 'Unsupported state:',
    waterHeater: 'Water Heater',
  },

  general: {
    brand: 'EcoNet',
    redacted: '****redacted****',
    undefined: 'undefined',
  },

  http: {
    authSuccess: 'Successfully authenticated',
    noDataReceived: 'No data received from EcoNet',
    reauthenticate: 'Attempting to re-authenticate',
    reauthFailed: 'Re-authentication failed:',
    retryInMinutes: 'Request failed. Retrying in %s minutes…',
    retryInSeconds: 'Request failed. Retrying in %s seconds…',
  },

  mqtt: {
    deviceAuthMissing: 'MQTT is missing device auth',
    deviceClientError: 'Device client error:',
    deviceConnected: 'Device client connected and listening for updates…',
    deviceConnectionClosed: 'Device client connection closed',
    deviceConnectionError: 'Device client cannot connect',
    deviceIdleConnection: 'Idle device client connection',
    deviceNotConnected: 'Device client not connected',
    deviceParseFailed: 'Failed to parse device client message:',
    deviceReconnectInMinutes: 'Will attempt to device client reconnect in %s minutes…',
    deviceReconnectInSeconds: 'Will attempt to device client reconnect in %s seconds…',
    userAuthMissing: 'MQTT is missing user auth',
    userClientError: 'User client error:',
    userConnected: 'User client connected and listening for updates…',
    userConnectionClosed: 'User client connection closed',
    userConnectionError: 'User client cannot connect',
    userIdleConnection: 'Idle user client connection',
    userNotConnected: 'User client not connected',
    userParseFailed: 'Failed to parse user client message:',
    userReconnectInMinutes: 'Will attempt to user client reconnect in %s minutes…',
    userReconnectInSeconds: 'Will attempt to user client reconnect in %s seconds…',
    unstableConnection: 'MQTT trouble staying connected',
  },

  startup: {
    badConfig: 'One or more required variables are missing from the config. Please check the documentation.',
    newEquipment: 'Adding new device:',
    noEquipment: 'No equipment found',
    removeDevice: 'Removing device:',
    restoringDevice: 'Restoring device:',
    setupComplete: '✓ Setup complete.',
    setupFailed: 'Setup failed:',
    welcome: [
      'Please ★ this plugin on GitHub if you\'re finding it useful! https://github.com/mpatfield/homebridge-econet-rheem',
      'Would you like to sponsor this plugin? https://github.com/sponsors/mpatfield',
      'Please rate us on HOOBS! https://plugins.hoobs.org/plugin/homebridge-econet-rheem',
      'Want to see this plugin in your own language? Please visit https://github.com/mpatfield/homebridge-econet-rheem/issues/35',
    ],
  },
};

export default en;