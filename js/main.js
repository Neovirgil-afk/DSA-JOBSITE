'use strict';

/*
 * Load each frontend feature independently. Static imports at the top of this
 * file mean a failure in ANY imported module prevents this file from running,
 * including authentication. Dynamic imports keep one broken feature from
 * disabling the login/signup modal and job listings.
 */
function startJobPath() {
    const features = [
        ['UI', './ui.js', 'initUI'],
        ['authentication', './auth.js', 'initAuth'],
        ['job listings', './jobs.js', 'initJobs']
    ];

    for (const [name, modulePath, initializerName] of features) {
        import(modulePath)
            .then((feature) => {
                const initializer = feature[initializerName];

                if (typeof initializer !== 'function') {
                    throw new Error('Missing initializer: ' + initializerName);
                }

                initializer();
                console.info('[JobPath] ' + name + ' initialized.');
            })
            .catch((error) => {
                console.error('[JobPath] Failed to load or initialize ' + name + ':', error);
            });
    }

    console.info('[JobPath] Frontend startup requested.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startJobPath, { once: true });
} else {
    startJobPath();
}
