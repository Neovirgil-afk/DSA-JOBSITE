'use strict';

import {
    initAutocomplete
} from './autocomplete.js';


export function initAuth() {

    /* =====================================================
       CREATE AUTH MODAL
       ===================================================== */

    function createAuthModal() {

        if (document.querySelector('#authOverlay')) {
            return;
        }


        const overlay =
            document.createElement('div');


        overlay.id =
            'authOverlay';


        overlay.className =
            'auth-overlay';


        overlay.innerHTML = `

            <div
                class="auth-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="authTitle"
            >

                <button
                    type="button"
                    class="auth-close"
                    id="authClose"
                    aria-label="Close"
                >
                    ×
                </button>


                <div class="auth-header">

                    <div class="auth-accent"></div>

                    <h2 id="authTitle">
                        Log In
                    </h2>

                    <p id="authSubtitle">
                        Welcome back! Log in to continue.
                    </p>

                </div>


                <form
                    class="auth-form"
                    id="authForm"
                >

                    <!-- SIGNUP STEP 1 -->

                    <div
                        id="signupStep1"
                        style="display: none;"
                    >

                        <div class="auth-field">

                            <label for="authFullName">
                                Full Name
                            </label>

                            <input
                                type="text"
                                id="authFullName"
                                name="fullName"
                                placeholder="Enter your full name"
                                autocomplete="name"
                            />

                        </div>


                        <div class="auth-field">

                            <label for="authEmail">
                                Email
                            </label>

                            <input
                                type="email"
                                id="authEmail"
                                name="email"
                                placeholder="Enter your email"
                                autocomplete="email"
                                required
                            />

                        </div>


                        <div class="auth-field">

                            <label for="authPassword">
                                Password
                            </label>

                            <input
                                type="password"
                                id="authPassword"
                                name="password"
                                placeholder="Enter your password"
                                autocomplete="current-password"
                                required
                            />

                        </div>


                        <div class="auth-field">

                            <label for="authConfirmPassword">
                                Confirm Password
                            </label>

                            <input
                                type="password"
                                id="authConfirmPassword"
                                name="confirmPassword"
                                placeholder="Confirm your password"
                                autocomplete="new-password"
                            />

                        </div>

                    </div>


                    <!-- SIGNUP STEP 2 -->

                    <div
                        id="signupStep2"
                        style="display: none;"
                    >

                        <div
                            class="auth-field autocomplete-field"
                            id="educationAutocomplete"
                        >

                            <label for="authEducation">
                                Education
                            </label>

                            <input
                                type="text"
                                id="authEducation"
                                name="education"
                                placeholder="Search your school..."
                                autocomplete="off"
                            />

                            <div
                                class="autocomplete-results"
                                id="schoolResults"
                                role="listbox"
                            ></div>

                        </div>


                        <div
                            class="auth-field autocomplete-field"
                            id="degreeAutocomplete"
                        >

                            <label for="authDegree">
                                Degree
                            </label>

                            <input
                                type="text"
                                id="authDegree"
                                name="degree"
                                placeholder="Search your degree..."
                                autocomplete="off"
                            />

                            <div
                                class="autocomplete-results"
                                id="degreeResults"
                                role="listbox"
                            ></div>

                        </div>


                        <div
                            class="auth-field autocomplete-field"
                            id="targetJobAutocomplete"
                        >

                            <label for="authTargetJob">
                                Target Job
                            </label>

                            <input
                                type="text"
                                id="authTargetJob"
                                name="targetJob"
                                placeholder="Select your degree first..."
                                autocomplete="off"
                                disabled
                            />

                            <div
                                class="autocomplete-results"
                                id="jobResults"
                                role="listbox"
                            ></div>

                        </div>


                        <!-- LOCATION AUTOCOMPLETE -->

                        <div
                            class="auth-field autocomplete-field"
                            id="locationAutocomplete"
                        >

                            <label for="authLocation">
                                Location
                            </label>

                            <input
                                type="text"
                                id="authLocation"
                                name="location"
                                placeholder="Search your location..."
                                autocomplete="off"
                            />

                            <div
                                class="autocomplete-results"
                                id="locationResults"
                                role="listbox"
                            ></div>

                        </div>


                        <button
                            type="button"
                            id="signupBack"
                            style="
                                background: none;
                                border: none;
                                padding: 4px 0 8px;
                                margin: 0;
                                color: #6B7280;
                                font-family: inherit;
                                font-size: 14px;
                                font-weight: 600;
                                cursor: pointer;
                                text-align: left;
                            "
                        >
                            ← Back
                        </button>

                    </div>


                    <!-- LOGIN -->

                    <div id="loginFields">

                        <div class="auth-field">

                            <label for="authEmailLogin">
                                Email
                            </label>

                            <input
                                type="email"
                                id="authEmailLogin"
                                placeholder="Enter your email"
                                autocomplete="email"
                            />

                        </div>


                        <div class="auth-field">

                            <label for="authPasswordLogin">
                                Password
                            </label>

                            <input
                                type="password"
                                id="authPasswordLogin"
                                placeholder="Enter your password"
                                autocomplete="current-password"
                            />

                        </div>

                    </div>


                    <div
                        class="auth-message"
                        id="authMessage"
                    ></div>


                    <button
                        type="submit"
                        class="btn btn-primary auth-submit"
                        id="authSubmit"
                    >
                        Log In
                    </button>

                </form>


                <p class="auth-switch">

                    <span id="authSwitchText">
                        Don't have an account?
                    </span>

                    <button
                        type="button"
                        id="authSwitch"
                    >
                        Sign Up
                    </button>

                </p>

            </div>
        `;


        document.body.appendChild(overlay);
    }


    createAuthModal();


    /* =====================================================
       ELEMENTS
       ===================================================== */

    const overlay =
        document.querySelector('#authOverlay');

    const closeButton =
        document.querySelector('#authClose');

    const form =
        document.querySelector('#authForm');

    const title =
        document.querySelector('#authTitle');

    const subtitle =
        document.querySelector('#authSubtitle');

    const submitButton =
        document.querySelector('#authSubmit');

    const switchButton =
        document.querySelector('#authSwitch');

    const switchText =
        document.querySelector('#authSwitchText');

    const signupStep1 =
        document.querySelector('#signupStep1');

    const signupStep2 =
        document.querySelector('#signupStep2');

    const loginFields =
        document.querySelector('#loginFields');

    const signupBack =
        document.querySelector('#signupBack');

    const fullName =
        document.querySelector('#authFullName');

    const signupEmail =
        document.querySelector('#authEmail');

    const password =
        document.querySelector('#authPassword');

    const confirmPassword =
        document.querySelector(
            '#authConfirmPassword'
        );

    const loginEmail =
        document.querySelector(
            '#authEmailLogin'
        );

    const loginPassword =
        document.querySelector(
            '#authPasswordLogin'
        );

    const education =
        document.querySelector(
            '#authEducation'
        );

    const degree =
        document.querySelector(
            '#authDegree'
        );

    const targetJob =
        document.querySelector(
            '#authTargetJob'
        );

    const locationInput =
        document.querySelector(
            '#authLocation'
        );

    const schoolResults =
        document.querySelector(
            '#schoolResults'
        );

    const degreeResults =
        document.querySelector(
            '#degreeResults'
        );

    const jobResults =
        document.querySelector(
            '#jobResults'
        );

    const locationResults =
        document.querySelector(
            '#locationResults'
        );

    const message =
        document.querySelector(
            '#authMessage'
        );


    /* =====================================================
       STATE
       ===================================================== */

    let authMode =
        'login';

    let signupStep =
        1;

    let schools =
        [];

    let degrees =
        [];

    let jobs =
        [];

    let locations =
        [];


    /* =====================================================
       MESSAGE
       ===================================================== */

    function showMessage(
        text,
        type = 'error'
    ) {

        message.textContent =
            text;

        message.className =
            `auth-message show ${type}`;
    }


    function clearMessage() {

        message.textContent =
            '';

        message.className =
            'auth-message';
    }


    /* =====================================================
       LOAD REFERENCE DATA
       ===================================================== */

    async function loadReferenceData() {

        try {

            const schoolResponse =
                await fetch(
                    '/api/reference/schools'
                );


            if (!schoolResponse.ok) {
                throw new Error(
                    'Failed to load schools.'
                );
            }


            const schoolData =
                await schoolResponse.json();


            if (
                schoolData.success &&
                Array.isArray(
                    schoolData.schools
                )
            ) {

                schools =
                    schoolData.schools;
            }


            const degreeResponse =
                await fetch(
                    '/api/reference/degrees'
                );


            if (!degreeResponse.ok) {
                throw new Error(
                    'Failed to load degrees.'
                );
            }


            const degreeData =
                await degreeResponse.json();


            if (
                degreeData.success &&
                Array.isArray(
                    degreeData.degrees
                )
            ) {

                degrees =
                    degreeData.degrees;
            }


            /* ---------------------------------------------
               LOAD LOCATIONS
               --------------------------------------------- */

            const locationResponse =
                await fetch(
                    '/api/reference/locations'
                );


            if (!locationResponse.ok) {
                throw new Error(
                    'Failed to load locations.'
                );
            }


            const locationData =
                await locationResponse.json();


            if (
                locationData.success &&
                Array.isArray(
                    locationData.locations
                )
            ) {

                locations =
                    locationData.locations;
            }


            console.log(
                '[reference] Schools loaded:',
                schools.length
            );


            console.log(
                '[reference] Degrees loaded:',
                degrees.length
            );


            console.log(
                '[reference] Locations loaded:',
                locations.length
            );

        } catch (error) {

            console.error(
                '[reference] Failed to load reference data:',
                error
            );
        }
    }


    /* =====================================================
       LOAD JOBS FOR DEGREE
       ===================================================== */

    async function loadJobsForDegree(
        selectedDegree
    ) {

        jobs = [];

        targetJob.value =
            '';

        targetJob.disabled =
            true;

        targetJob.placeholder =
            'Loading related jobs...';

        jobResults.classList.remove(
            'show'
        );

        jobResults.innerHTML =
            '';


        if (
            !selectedDegree ||
            !selectedDegree.trim()
        ) {

            targetJob.placeholder =
                'Select your degree first...';

            return;
        }


        try {

            const response =
                await fetch(
                    `/api/reference/jobs?degree=${encodeURIComponent(selectedDegree)}`
                );


            if (!response.ok) {

                throw new Error(
                    'Failed to load related jobs.'
                );
            }


            const data =
                await response.json();


            if (!data.success) {

                throw new Error(
                    data.error ||
                    'Failed to load related jobs.'
                );
            }


            jobs =
                Array.isArray(data.jobs)
                    ? data.jobs
                    : [];


            targetJob.disabled =
                false;


            targetJob.placeholder =
                jobs.length
                    ? 'Search related jobs...'
                    : 'No related jobs found';


            console.log(
                '[reference] Related jobs loaded:',
                jobs.length,
                'for degree:',
                selectedDegree
            );

        } catch (error) {

            console.error(
                '[reference] Failed to load related jobs:',
                error
            );


            targetJob.disabled =
                false;

            targetJob.placeholder =
                'Search target job...';
        }
    }


    /* =====================================================
       SET SIGNUP STEP
       ===================================================== */

    function showSignupStep(step) {

        signupStep =
            step;

        clearMessage();


        if (step === 1) {

            signupStep1.style.display =
                'block';

            signupStep2.style.display =
                'none';

            title.textContent =
                'Create your account';

            subtitle.textContent =
                'Sign up and start building your future.';

            submitButton.textContent =
                'Continue';


            setTimeout(() => {
                fullName.focus();
            }, 50);

        } else {

            signupStep1.style.display =
                'none';

            signupStep2.style.display =
                'block';

            title.textContent =
                'Tell us about yourself';

            subtitle.textContent =
                'Help us personalize your career path.';

            submitButton.textContent =
                'Sign Up';


            setTimeout(() => {
                education.focus();
            }, 50);
        }


        submitButton.disabled =
            false;
    }


    /* =====================================================
       SET AUTH MODE
       ===================================================== */

    function setAuthMode(mode) {

        authMode =
            mode;

        clearMessage();

        form.reset();

        signupStep =
            1;

        jobs =
            [];

        targetJob.disabled =
            true;

        targetJob.placeholder =
            'Select your degree first...';

        jobResults.classList.remove(
            'show'
        );

        jobResults.innerHTML =
            '';

        locationResults.classList.remove(
            'show'
        );

        locationResults.innerHTML =
            '';


        if (mode === 'login') {

            title.textContent =
                'Log In';

            subtitle.textContent =
                'Welcome back! Log in to continue.';

            submitButton.textContent =
                'Log In';

            switchText.textContent =
                "Don't have an account?";

            switchButton.textContent =
                'Sign Up';

            loginFields.style.display =
                'block';

            signupStep1.style.display =
                'none';

            signupStep2.style.display =
                'none';


            loginEmail.required =
                true;

            loginPassword.required =
                true;

            fullName.required =
                false;

            signupEmail.required =
                false;

            password.required =
                false;

            confirmPassword.required =
                false;

            education.required =
                false;

            degree.required =
                false;

            targetJob.required =
                false;

            locationInput.required =
                false;


            setTimeout(() => {
                loginEmail.focus();
            }, 50);

        } else {

            switchText.textContent =
                'Already have an account?';

            switchButton.textContent =
                'Log In';

            loginFields.style.display =
                'none';


            loginEmail.required =
                false;

            loginPassword.required =
                false;

            fullName.required =
                true;

            signupEmail.required =
                true;

            password.required =
                true;

            confirmPassword.required =
                true;

            education.required =
                false;

            degree.required =
                false;

            targetJob.required =
                false;

            locationInput.required =
                false;


            showSignupStep(1);
        }
    }


    /* =====================================================
       OPEN / CLOSE
       ===================================================== */

    function openAuth(mode = 'login') {

        setAuthMode(mode);

        overlay.classList.add(
            'active'
        );

        document.body.style.overflow =
            'hidden';
    }


    function closeAuth() {

        overlay.classList.remove(
            'active'
        );

        document.body.style.overflow =
            '';

        clearMessage();
    }


    /* =====================================================
       HEADER AFTER LOGIN
       ===================================================== */

    function updateHeaderAfterLogin(
        data
    ) {

        const actions =
            document.querySelector(
                '.header-actions'
            );


        if (!actions) {
            return;
        }


        const name =
            data.fullName ||
            data.user?.full_name ||
            data.user?.fullName ||
            'Account';


        actions.innerHTML = `

            <span
                class="login-link"
                style="cursor: default;"
            >
                👋 ${name}
            </span>

            <button
                type="button"
                class="btn btn-primary"
                id="logoutButton"
            >
                Log Out
            </button>

        `;


        const logoutButton =
            document.querySelector(
                '#logoutButton'
            );


        if (logoutButton) {

            logoutButton.addEventListener(
                'click',
                async () => {

                    try {

                        await fetch(
                            '/api/auth/logout',
                            {
                                method: 'POST',
                                credentials: 'include'
                            }
                        );

                    } catch (error) {

                        console.error(
                            'Logout error:',
                            error
                        );
                    }


                    location.reload();
                }
            );
        }
    }


    /* =====================================================
       LOGIN BUTTON
       ===================================================== */

    const loginLink =
        document.querySelector(
            '.login-link'
        );


    if (loginLink) {

        loginLink.addEventListener(
            'click',
            (event) => {

                event.preventDefault();

                openAuth('login');
            }
        );
    }


    /* =====================================================
       SIGNUP BUTTON
       ===================================================== */

    const signupButton =
        document.querySelector(
            '.header-actions .btn-primary'
        );


    if (signupButton) {

        signupButton.addEventListener(
            'click',
            (event) => {

                event.preventDefault();

                openAuth('signup');
            }
        );
    }


    /* =====================================================
       CTA SIGNUP
       ===================================================== */

    const createAccountButton =
        document.querySelector(
            '.cta-inner .btn-amber'
        );


    if (createAccountButton) {

        createAccountButton.addEventListener(
            'click',
            (event) => {

                event.preventDefault();

                openAuth('signup');
            }
        );
    }


    /* =====================================================
       SWITCH AUTH MODE
       ===================================================== */

    switchButton.addEventListener(
        'click',
        () => {

            setAuthMode(
                authMode === 'login'
                    ? 'signup'
                    : 'login'
            );
        }
    );


    /* =====================================================
       BACK
       ===================================================== */

    signupBack.addEventListener(
        'click',
        () => {

            showSignupStep(1);
        }
    );


    /* =====================================================
       CLOSE
       ===================================================== */

    closeButton.addEventListener(
        'click',
        closeAuth
    );


    overlay.addEventListener(
        'click',
        (event) => {

            if (
                event.target === overlay
            ) {

                closeAuth();
            }
        }
    );


    document.addEventListener(
        'keydown',
        (event) => {

            if (
                event.key === 'Escape' &&
                overlay.classList.contains(
                    'active'
                )
            ) {

                closeAuth();
            }
        }
    );


    /* =====================================================
       AUTOCOMPLETE
       ===================================================== */

    initAutocomplete({

        educationInput:
            education,

        schoolResults:
            schoolResults,

        degreeInput:
            degree,

        degreeResults:
            degreeResults,

        targetJobInput:
            targetJob,

        jobResults:
            jobResults,

        locationInput:
            locationInput,

        locationResults:
            locationResults,

        getSchools:
            () => schools,

        getDegrees:
            () => degrees,

        getJobs:
            () => jobs,

        getLocations:
            () => locations,

        onDegreeSelect:
            (selectedDegree) => {

                loadJobsForDegree(
                    selectedDegree.name
                );
            }
    });


    /* =====================================================
       FORM SUBMIT
       ===================================================== */

    form.addEventListener(
        'submit',
        async (event) => {

            event.preventDefault();

            clearMessage();


            /* ---------------------------------------------
               SIGNUP STEP 1
               --------------------------------------------- */

            if (
                authMode === 'signup' &&
                signupStep === 1
            ) {

                const name =
                    fullName.value.trim();

                const email =
                    signupEmail.value.trim();

                const pass =
                    password.value;

                const confirm =
                    confirmPassword.value;


                if (!name) {

                    showMessage(
                        'Please enter your full name.'
                    );

                    fullName.focus();

                    return;
                }


                if (!email) {

                    showMessage(
                        'Please enter your email.'
                    );

                    signupEmail.focus();

                    return;
                }


                if (
                    !signupEmail.checkValidity()
                ) {

                    showMessage(
                        'Please enter a valid email address.'
                    );

                    signupEmail.focus();

                    return;
                }


                if (!pass) {

                    showMessage(
                        'Please enter a password.'
                    );

                    password.focus();

                    return;
                }


                if (pass.length < 6) {

                    showMessage(
                        'Password must be at least 6 characters.'
                    );

                    password.focus();

                    return;
                }


                if (!confirm) {

                    showMessage(
                        'Please confirm your password.'
                    );

                    confirmPassword.focus();

                    return;
                }


                if (pass !== confirm) {

                    showMessage(
                        'Passwords do not match.'
                    );

                    confirmPassword.focus();

                    return;
                }


                showSignupStep(2);

                return;
            }


            /* ---------------------------------------------
               SIGNUP STEP 2
               --------------------------------------------- */

            if (
                authMode === 'signup' &&
                signupStep === 2
            ) {

                if (!education.value.trim()) {

                    showMessage(
                        'Please enter your education.'
                    );

                    education.focus();

                    return;
                }


                if (!degree.value.trim()) {

                    showMessage(
                        'Please enter your degree.'
                    );

                    degree.focus();

                    return;
                }


                if (!targetJob.value.trim()) {

                    showMessage(
                        'Please enter your target job.'
                    );

                    targetJob.focus();

                    return;
                }


                if (!locationInput.value.trim()) {

                    showMessage(
                        'Please enter your location.'
                    );

                    locationInput.focus();

                    return;
                }
            }


            /* ---------------------------------------------
               SUBMIT
               --------------------------------------------- */

            submitButton.disabled =
                true;


            submitButton.textContent =
                authMode === 'login'
                    ? 'Logging in...'
                    : 'Creating account...';


            try {

                const endpoint =
                    authMode === 'login'
                        ? '/api/auth/login'
                        : '/api/auth/register';


                let body;


                if (authMode === 'login') {

                    body = {

                        email:
                            loginEmail.value.trim(),

                        password:
                            loginPassword.value
                    };

                } else {

                    body = {

                        fullName:
                            fullName.value.trim(),

                        email:
                            signupEmail.value.trim(),

                        password:
                            password.value,

                        confirmPassword:
                            confirmPassword.value,

                        education:
                            education.value.trim(),

                        degree:
                            degree.value.trim(),

                        targetJob:
                            targetJob.value.trim(),

                        location:
                            locationInput.value.trim()
                    };
                }


                const response =
                    await fetch(
                        endpoint,
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            credentials:
                                'include',

                            body:
                                JSON.stringify(body)
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        data.error ||
                        'Something went wrong.'
                    );
                }


                showMessage(
                    authMode === 'login'
                        ? 'Login successful! Welcome back.'
                        : 'Account created successfully!',
                    'success'
                );


                submitButton.textContent =
                    'Success!';


                setTimeout(() => {

                    closeAuth();

                    updateHeaderAfterLogin(
                        data
                    );

                }, 700);


            } catch (error) {

                console.error(
                    'Authentication error:',
                    error
                );


                showMessage(
                    error.message ||
                    'Authentication failed.'
                );


            } finally {

                setTimeout(() => {

                    submitButton.disabled =
                        false;


                    if (
                        authMode === 'login'
                    ) {

                        submitButton.textContent =
                            'Log In';

                    } else if (
                        signupStep === 1
                    ) {

                        submitButton.textContent =
                            'Continue';

                    } else {

                        submitButton.textContent =
                            'Sign Up';
                    }

                }, 800);
            }
        }
    );


    /* =====================================================
       CHECK EXISTING SESSION
       ===================================================== */

    async function checkCurrentUser() {

        try {

            const response =
                await fetch(
                    '/api/auth/me',
                    {
                        credentials:
                            'include'
                    }
                );


            if (!response.ok) {
                return;
            }


            const data =
                await response.json();


            if (data.user) {

                updateHeaderAfterLogin({
                    fullName:
                        data.user.full_name ||
                        data.user.fullName
                });
            }

        } catch (error) {

            console.error(
                'Session check error:',
                error
            );
        }
    }


    loadReferenceData();

    checkCurrentUser();
}