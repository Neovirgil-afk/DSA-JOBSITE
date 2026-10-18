'use strict';

import {
    initUI
} from './ui.js';

import {
    initAuth
} from './auth.js';

import {
    initJobs
} from './jobs.js';


/* =========================================================
   APPLICATION STARTUP
   Initialize each feature independently so one UI error
   cannot silently disable authentication and job listings.
   ========================================================= */

function initializeFeature(name, initializer) {
    try {
        initializer();
        console.info('[JobPath] ' + name + ' initialized.');
    } catch (error) {
        console.error('[JobPath] Failed to initialize ' + name + ':', error);
    }
}

function startJobPath() {
    initializeFeature('UI', initUI);
    initializeFeature('authentication', initAuth);
    initializeFeature('job listings', initJobs);
    console.info('[JobPath] Frontend startup finished.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startJobPath, { once: true });
} else {
    startJobPath();
}
