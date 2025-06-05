import merge from 'lodash.merge';

import en from './en.js';

const overrides = {

  config: {

    description: {
      email: 'Zzzzzz/Zzzzz zzzzzzz zzzzz zzzzz (zzzzzzzzz zzzzz zzzzzzzzzzz)',
    },

    support: 'Zzz zzz zzzz zz zzzzz zzzzzz zzzzz zzzz %s',
    
    title: {
      password: 'Zzzzzzzz',
    },
  },

  debug: {
    runningState: '%s zzzzzz zzzzz = %s',
  },

  equipment: {
    waterHeater: 'Zzzzz Zzzzzz',
  },

  general: {
    brand: 'ZzzZzz',
    redacted: '****zzzzzzzz****',
  },

  http: {
    authSuccess: 'Zzzzzzzzzzzzzzz zzzzzzzzzzzzz',
  },

  mqtt: {
    connected: 'Zzzzzzzz zz zzzzzzzg zzz zzzzzzz…',
  },

  startup: {
    setupComplete: '✓ Zzzzz zzzzzzz.',
  },
};

const zz = merge({}, en, overrides);

export default zz;