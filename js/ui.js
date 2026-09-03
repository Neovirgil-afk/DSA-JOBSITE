'use strict';


export function initUI() {

    const menuToggle =
        document.querySelector('#menuToggle');


    if (menuToggle) {

        menuToggle.addEventListener(
            'click',
            () => {

                document.body.classList.toggle(
                    'nav-open'
                );

            }
        );
    }
}