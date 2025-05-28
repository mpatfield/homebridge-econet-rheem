const langEn = {
  
  // General
  brand: 'EcoNet',

  // Startup
  badConfig: 'One or more required variables are missing from the config. Please check the documentation. https://github.com/mpatfield/homebridge-econet-rheem',
  invalidCredentials: 'Invalid credentials',
  newThermostat: 'Adding new thermostat:',
  newWaterHeater: 'Adding new water heater:',
  removeDevice: 'Removing device:',
  restoringDevice: 'Restoring device:',
  setupComplete: '✓ Setup complete.',
  setupFailed: 'Setup failed:',
  welcomeMessages: [
    'Please ★ this plugin on GitHub if you\'re finding it useful! https://github.com/mpatfield/homebridge-econet-rheem',
    'Would you like to sponsor this plugin? https://github.com/sponsors/mpatfield',
    'Please rate us on HOOBS! https://plugins.hoobs.org/plugin/homebridge-econet-rheem',
    'Want to see this plugin in your own language? Please create a ticket! https://github.com/mpatfield/homebridge-econet-rheem/issues',
  ],

  // Equipment
  thermostat: 'Thermostat',
  waterHeater: 'Water Heater',
  equipmentError: 'Equipment error:',
  outOfRangeCool: 'Cool setpoint out of range, lower: %s, upper: %s, setpoint: %s',
  outOfRangeHeat: 'Heat setpoint out of range, lower: %s, upper: %s, setpoint: %s',
  setpointUnknown: 'Cannot determine desired setpoint when mode is %s',
  unknownMode: 'Unknown thermostat mode:',
  unsupportedState: 'Unsupported state:',

  // HTTP
  authSuccess: 'Successfully authenticated',
  creatingEquipment: 'Creating equipment with data:',
  httpError: 'HTTP error:',
  invalidResponse: 'Invalid response format',
  noEquipment: 'No equipment',
  reauthenticate: 'Attempting to re-authenticate',
  reauthFailed: 'Re-authentication failed:',

  // MQTT
  connected: 'Connected and listening for updates…',
  connectionClosed: 'Connection closed',
  clientError: 'Client error:',
  clientNotConnected: 'Client not connected',
  idleConnection: 'Idle connection',
  noMQTTOptions: 'MQTT options are undefined',
  parseFailed: 'Failed to parse message:',
  reconnectInMinutes: 'Will attempt to reconnect in %s minutes…',
  reconnectInSeconds: 'Will attempt to reconnect in %s seconds…',
  topicPublish: 'Publishing message to topic: %s\n',
  topicUpdate: 'Received message from topic: %s\n',
  unstableConnection: 'Having trouble staying connected',

  // Debug
  alertCount: '%s alert count = %s',
  availabilityState: '%s availability = %s',
  clientOffline: 'Client offline',
  currentTempState: '%s current temp = %s',
  coolSetpoint: '%s cool setpoint = %s',
  enabledState: '%s enabled = %s',
  heatSetpoint: '%s heat setpoint = %s',
  humidityState: '%s humidity = %s',
  modeState: '%s mode = %s',
  runningState: '%s running = %s',
  setpointState: '%s setpoint = %s',
  updateReceived: 'Received update for %s',
};

export default langEn;