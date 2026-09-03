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
   ========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        initUI();

        initAuth();

        initJobs();

        console.log(
            '[JobPath] Frontend initialized.'
        );
    }
);