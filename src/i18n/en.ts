const en = {

  config: {
    continue: 'Continue %s',

    description: {
      email: 'Econet/Rheem account email (dedicated account recommended)',
      password: 'Econet/Rheem account password',
      verbose: 'Enable additional debug logging',
      wh_sim_disable: 'See documentation for details',
    },

    needed: 'You will need your Rheem username and password',
    support: 'For help and support please visit %s',
    thankYou: 'Thank you for installing Homebridge Econet Rheem',

    title: {
      email: 'Email',
      password: 'Password',
      verbose: 'Verbose',
      wh_sim_disable: 'Disable Water Heater Temperature Simulator',
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
    authMissing: 'MQTT is missing auth',
    clientError: 'Client error:',
    connected: 'Connected and listening for updates…',
    connectionClosed: 'Connection closed',
    connectionError: 'MQTT cannot connect',
    idleConnection: 'Idle connection',
    notConnected: 'Client not connected',
    parseFailed: 'Failed to parse message:',
    reconnectInMinutes: 'Will attempt to reconnect in %s minutes…',
    reconnectInSeconds: 'Will attempt to reconnect in %s seconds…',
    unstableConnection: 'Having trouble staying connected',
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