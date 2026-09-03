(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) =>
    Array.from(ctx.querySelectorAll(sel));


  /* =========================================================
     MOBILE NAV
     ========================================================= */

  const menuToggle = $('#menuToggle');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
    });
  }


  /* =========================================================
     AUTH MODAL
     ========================================================= */

  function createAuthModal() {
    if ($('#authOverlay')) return;

    const overlay = document.createElement('div');

    overlay.id = 'authOverlay';
    overlay.className = 'auth-overlay';

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

          <h2 id="authTitle">Log In</h2>

          <p id="authSubtitle">
            Welcome back! Log in to continue.
          </p>

        </div>


        <form class="auth-form" id="authForm">

          <!-- =================================================
               SIGN UP STEP 1
               ================================================= -->

          <div id="signupStep1" style="display: none;">

            <!-- FULL NAME -->
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


            <!-- EMAIL -->
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


            <!-- PASSWORD -->
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


            <!-- CONFIRM PASSWORD -->
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


          <!-- =================================================
               SIGN UP STEP 2
               ================================================= -->

          <div id="signupStep2" style="display: none;">

            <!-- EDUCATION -->
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


            <!-- DEGREE -->
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


            <!-- TARGET JOB -->
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


            <!-- LOCATION -->
            <div class="auth-field">

              <label for="authLocation">
                Location
              </label>

              <input
                type="text"
                id="authLocation"
                name="location"
                placeholder="e.g. Manila, Philippines"
                autocomplete="address-level2"
              />

            </div>


            <!-- BACK BUTTON -->
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


          <!-- =================================================
               LOGIN
               ================================================= -->

          <div id="loginFields">

            <!-- EMAIL -->
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


            <!-- PASSWORD -->
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


          <!-- MESSAGE -->
          <div
            class="auth-message"
            id="authMessage"
          ></div>


          <!-- SUBMIT / CONTINUE -->
          <button
            type="submit"
            class="btn btn-primary auth-submit"
            id="authSubmit"
          >
            Log In
          </button>

        </form>


        <!-- SWITCH LOGIN / SIGN UP -->
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


  /* =========================================================
     AUTOCOMPLETE STYLES
     ========================================================= */

  const autocompleteStyle =
    document.createElement('style');

  autocompleteStyle.textContent = `

    .autocomplete-field {
      position: relative;
    }

    .autocomplete-results {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 9999;

      display: none;

      margin-top: 5px;

      background: #ffffff;
      border: 1px solid #ECEBF3;
      border-radius: 10px;

      box-shadow:
        0 10px 25px rgba(35, 25, 90, 0.15);

      /*
       * Keep the dropdown compact while allowing
       * the user to scroll through ALL results.
       */
      max-height: 300px;

      overflow-y: auto;
      overflow-x: hidden;

      /*
       * Smooth scrollbar behavior.
       */
      overscroll-behavior: contain;

      scrollbar-width: thin;
    }

    .autocomplete-results.show {
      display: block;
    }

    .autocomplete-item {
      padding: 11px 13px;

      background: #ffffff;

      color: #14162B;

      font-family: inherit;
      font-size: 14px;
      line-height: 1.4;

      cursor: pointer;

      border-bottom: 1px solid #F1F0F5;

      transition:
        background 0.15s ease,
        color 0.15s ease;
    }

    .autocomplete-item:last-child {
      border-bottom: none;
    }

    .autocomplete-item:hover,
    .autocomplete-item.active {
      background: #EEECFB;
      color: #3730A3;
    }

    .autocomplete-item strong {
      font-weight: 700;
    }

    .autocomplete-empty {
      padding: 11px 13px;

      color: #6B7280;

      font-family: inherit;
      font-size: 13px;
    }

    /*
     * Small scrollbar for long school/degree/job lists.
     */
    .autocomplete-results::-webkit-scrollbar {
      width: 7px;
    }

    .autocomplete-results::-webkit-scrollbar-track {
      background: #F7F7FA;
      border-radius: 10px;
    }

    .autocomplete-results::-webkit-scrollbar-thumb {
      background: #C9C6D9;
      border-radius: 10px;
    }

    .autocomplete-results::-webkit-scrollbar-thumb:hover {
      background: #A9A5BE;
    }

  `;

  document.head.appendChild(autocompleteStyle);


  /* =========================================================
     AUTH ELEMENTS
     ========================================================= */

  const authOverlay = $('#authOverlay');
  const authClose = $('#authClose');
  const authForm = $('#authForm');

  const authTitle = $('#authTitle');
  const authSubtitle = $('#authSubtitle');
  const authSubmit = $('#authSubmit');

  const authSwitch = $('#authSwitch');
  const authSwitchText = $('#authSwitchText');

  const signupStep1 = $('#signupStep1');
  const signupStep2 = $('#signupStep2');
  const loginFields = $('#loginFields');
  const signupBack = $('#signupBack');

  const authFullName = $('#authFullName');
  const authEmail = $('#authEmail');
  const authPassword = $('#authPassword');
  const authConfirmPassword = $('#authConfirmPassword');

  const authEmailLogin = $('#authEmailLogin');
  const authPasswordLogin = $('#authPasswordLogin');

  const authEducation = $('#authEducation');
  const authDegree = $('#authDegree');
  const authTargetJob = $('#authTargetJob');
  const authLocation = $('#authLocation');

  const schoolResults = $('#schoolResults');
  const degreeResults = $('#degreeResults');
  const jobResults = $('#jobResults');

  const authMessage = $('#authMessage');

  let authMode = 'login';
  let signupStep = 1;


  /* =========================================================
     REFERENCE DATA
     ========================================================= */

  let schoolData = [];
  let degreeData = [];
  let jobData = [];


  /* =========================================================
     LOAD JOBS RELATED TO DEGREE
     ========================================================= */

  async function loadJobsForDegree(degree) {

    jobData = [];

    authTargetJob.value = '';

    authTargetJob.disabled = true;

    authTargetJob.placeholder =
      'Loading related jobs...';

    jobResults.classList.remove('show');
    jobResults.innerHTML = '';


    if (!degree || !degree.trim()) {

      authTargetJob.placeholder =
        'Select your degree first...';

      return;

    }


    try {

      const response =
        await fetch(
          `/api/reference/jobs?degree=${encodeURIComponent(degree)}`
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


      jobData =
        Array.isArray(data.jobs)
          ? data.jobs
          : [];


      authTargetJob.disabled =
        false;


      if (jobData.length) {

        authTargetJob.placeholder =
          'Search related jobs...';

      } else {

        authTargetJob.placeholder =
          'No related jobs found';

      }


      console.log(
        '[reference] Related jobs loaded:',
        jobData.length,
        'for degree:',
        degree
      );

    } catch (error) {

      console.error(
        '[reference] Failed to load related jobs:',
        error
      );


      authTargetJob.disabled =
        false;


      authTargetJob.placeholder =
        'Search target job...';

    }

  }


  /* =========================================================
     AUTOCOMPLETE FUNCTION
     ========================================================= */

  function setupAutocomplete(
    input,
    resultsContainer,
    getData,
    getLabel,
    onSelect = null
  ) {

    let activeIndex = -1;


    /* -------------------------------------------------------
       HIDE RESULTS
       ------------------------------------------------------- */

    function hideResults() {

      resultsContainer.classList.remove('show');

      resultsContainer.innerHTML = '';

      activeIndex = -1;

    }


    /* -------------------------------------------------------
       SHOW RESULTS
       ------------------------------------------------------- */

    function showResults() {

      const query =
        input.value.trim().toLowerCase();


      /*
       * Don't show anything if the user hasn't typed.
       */

      if (!query) {

        hideResults();

        return;

      }


      const data =
        getData();


      /*
       * Find matching items.
       *
       * Starts-with matches are placed first,
       * followed by matches anywhere in the name.
       */

      const startsWithMatches =
        data.filter((item) =>
          getLabel(item)
            .toLowerCase()
            .startsWith(query)
        );


      const containsMatches =
        data.filter((item) => {

          const name =
            getLabel(item).toLowerCase();

          return (
            name.includes(query) &&
            !name.startsWith(query)
          );

        });


      /*
       * IMPORTANT:
       *
       * Do NOT use .slice(0, 6) here.
       *
       * We keep ALL matching results in the
       * dropdown so the user can scroll through
       * every matching school or degree.
       */

      const matches = [
        ...startsWithMatches,
        ...containsMatches
      ];


      resultsContainer.innerHTML = '';


      if (!matches.length) {

        const empty =
          document.createElement('div');

        empty.className =
          'autocomplete-empty';

        empty.textContent =
          'No matches found';

        resultsContainer.appendChild(empty);

        resultsContainer.classList.add('show');

        return;

      }


      /*
       * Create an item for EVERY matching result.
       *
       * The CSS max-height controls how many
       * are visible at once.
       */

      matches.forEach((item, index) => {

        const result =
          document.createElement('div');

        result.className =
          'autocomplete-item';

        result.setAttribute(
          'role',
          'option'
        );


        result.setAttribute(
          'data-index',
          index
        );


        result.textContent =
          getLabel(item);


        result.addEventListener(
          'mousedown',
          (event) => {

            /*
             * Prevent the input from losing focus
             * before the selection is applied.
             */

            event.preventDefault();


            input.value =
              getLabel(item);


            hideResults();


            input.focus();


            /*
             * Run the optional selection callback.
             *
             * This is used for the Degree field
             * so Target Job updates only after
             * the user selects a degree.
             */

            if (typeof onSelect === 'function') {

              onSelect(item);

            }

          }
        );


        resultsContainer.appendChild(result);

      });


      resultsContainer.classList.add('show');

      activeIndex = -1;

    }


    /* -------------------------------------------------------
       UPDATE ACTIVE ITEM
       ------------------------------------------------------- */

    function updateActiveItem() {

      const items =
        resultsContainer.querySelectorAll(
          '.autocomplete-item'
        );


      items.forEach((item, index) => {

        item.classList.toggle(
          'active',
          index === activeIndex
        );

      });


      if (
        activeIndex >= 0 &&
        items[activeIndex]
      ) {

        items[activeIndex].scrollIntoView({
          block: 'nearest'
        });

      }

    }


    /* -------------------------------------------------------
       INPUT
       ------------------------------------------------------- */

    input.addEventListener(
      'input',
      () => {

        showResults();

      }
    );


    /* -------------------------------------------------------
       FOCUS
       ------------------------------------------------------- */

    input.addEventListener(
      'focus',
      () => {

        /*
         * Only show suggestions if something
         * has already been typed.
         */

        if (input.value.trim()) {

          showResults();

        }

      }
    );


    /* -------------------------------------------------------
       KEYBOARD NAVIGATION
       ------------------------------------------------------- */

    input.addEventListener(
      'keydown',
      (event) => {

        const items =
          resultsContainer.querySelectorAll(
            '.autocomplete-item'
          );


        if (
          !resultsContainer.classList.contains('show') ||
          !items.length
        ) {

          if (event.key === 'Escape') {

            hideResults();

          }

          return;

        }


        /* ---------- ARROW DOWN ---------- */

        if (event.key === 'ArrowDown') {

          event.preventDefault();

          activeIndex++;


          if (
            activeIndex >= items.length
          ) {

            activeIndex = 0;

          }


          updateActiveItem();

        }


        /* ---------- ARROW UP ---------- */

        else if (event.key === 'ArrowUp') {

          event.preventDefault();

          activeIndex--;


          if (activeIndex < 0) {

            activeIndex =
              items.length - 1;

          }


          updateActiveItem();

        }


        /* ---------- HOME ---------- */

        else if (event.key === 'Home') {

          /*
           * Jump directly to the first result.
           */

          event.preventDefault();

          activeIndex = 0;

          updateActiveItem();

        }


        /* ---------- END ---------- */

        else if (event.key === 'End') {

          /*
           * Jump directly to the last result.
           */

          event.preventDefault();

          activeIndex =
            items.length - 1;

          updateActiveItem();

        }


        /* ---------- ENTER ---------- */

        else if (
          event.key === 'Enter' &&
          activeIndex >= 0
        ) {

          event.preventDefault();


          const selectedLabel =
            items[activeIndex].textContent;


          input.value =
            selectedLabel;


          hideResults();


          /*
           * Keyboard selection should also
           * trigger the optional callback.
           */

          if (typeof onSelect === 'function') {

            const data =
              getData();


            const selectedItem =
              data.find(
                (item) =>
                  getLabel(item) ===
                  selectedLabel
              );


            if (selectedItem) {

              onSelect(selectedItem);

            }

          }

        }


        /* ---------- ESCAPE ---------- */

        else if (event.key === 'Escape') {

          event.preventDefault();

          hideResults();

        }

      }
    );


    /* -------------------------------------------------------
       CLICK OUTSIDE
       ------------------------------------------------------- */

    document.addEventListener(
      'click',
      (event) => {

        if (
          !input.contains(event.target) &&
          !resultsContainer.contains(event.target)
        ) {

          hideResults();

        }

      }
    );

  }


  /* =========================================================
     TARGET JOB AUTOCOMPLETE
     ========================================================= */

  function setupTargetJobAutocomplete() {

    let activeIndex = -1;


    /* -------------------------------------------------------
       HIDE JOB RESULTS
       ------------------------------------------------------- */

    function hideJobResults() {

      jobResults.classList.remove('show');

      jobResults.innerHTML = '';

      activeIndex = -1;

    }


    /* -------------------------------------------------------
       SHOW JOB RESULTS
       ------------------------------------------------------- */

    function showJobResults() {

      const query =
        authTargetJob.value
          .trim()
          .toLowerCase();


      if (
        authTargetJob.disabled ||
        !jobData.length
      ) {

        hideJobResults();

        return;

      }


      let matches =
        jobData;


      /*
       * If the user typed something,
       * filter the jobs by title.
       */

      if (query) {

        const startsWithMatches =
          jobData.filter((job) =>
            job.title
              .toLowerCase()
              .startsWith(query)
          );


        const containsMatches =
          jobData.filter((job) => {

            const title =
              job.title.toLowerCase();

            return (
              title.includes(query) &&
              !title.startsWith(query)
            );

          });


        matches = [
          ...startsWithMatches,
          ...containsMatches
        ];

      }


      /*
       * IMPORTANT:
       *
       * Do NOT limit this to 6.
       *
       * Keep all matching jobs so the user
       * can scroll through them.
       */

      jobResults.innerHTML = '';


      if (!matches.length) {

        const empty =
          document.createElement('div');

        empty.className =
          'autocomplete-empty';

        empty.textContent =
          'No related jobs found';

        jobResults.appendChild(empty);

        jobResults.classList.add('show');

        return;

      }


      matches.forEach((job, index) => {

        const result =
          document.createElement('div');

        result.className =
          'autocomplete-item';

        result.setAttribute(
          'role',
          'option'
        );


        result.setAttribute(
          'data-index',
          index
        );


        result.textContent =
          job.title;


        result.addEventListener(
          'mousedown',
          (event) => {

            event.preventDefault();


            authTargetJob.value =
              job.title;


            hideJobResults();


            authTargetJob.focus();

          }
        );


        jobResults.appendChild(result);

      });


      jobResults.classList.add('show');

      activeIndex = -1;

    }


    /* -------------------------------------------------------
       INPUT
       ------------------------------------------------------- */

    authTargetJob.addEventListener(
      'input',
      () => {

        showJobResults();

      }
    );


    /* -------------------------------------------------------
       FOCUS
       ------------------------------------------------------- */

    authTargetJob.addEventListener(
      'focus',
      () => {

        if (
          !authTargetJob.disabled &&
          jobData.length
        ) {

          showJobResults();

        }

      }
    );


    /* -------------------------------------------------------
       KEYBOARD NAVIGATION
       ------------------------------------------------------- */

    authTargetJob.addEventListener(
      'keydown',
      (event) => {

        const items =
          jobResults.querySelectorAll(
            '.autocomplete-item'
          );


        if (
          !jobResults.classList.contains('show') ||
          !items.length
        ) {

          if (event.key === 'Escape') {

            hideJobResults();

          }

          return;

        }


        /* ---------- ARROW DOWN ---------- */

        if (event.key === 'ArrowDown') {

          event.preventDefault();

          activeIndex++;


          if (
            activeIndex >= items.length
          ) {

            activeIndex = 0;

          }


          items.forEach(
            (item, index) => {

              item.classList.toggle(
                'active',
                index === activeIndex
              );

            }
          );


          if (
            items[activeIndex]
          ) {

            items[activeIndex].scrollIntoView({
              block: 'nearest'
            });

          }

        }


        /* ---------- ARROW UP ---------- */

        else if (
          event.key === 'ArrowUp'
        ) {

          event.preventDefault();

          activeIndex--;


          if (activeIndex < 0) {

            activeIndex =
              items.length - 1;

          }


          items.forEach(
            (item, index) => {

              item.classList.toggle(
                'active',
                index === activeIndex
              );

            }
          );


          if (
            items[activeIndex]
          ) {

            items[activeIndex].scrollIntoView({
              block: 'nearest'
            });

          }

        }


        /* ---------- HOME ---------- */

        else if (
          event.key === 'Home'
        ) {

          event.preventDefault();

          activeIndex = 0;


          items.forEach(
            (item, index) => {

              item.classList.toggle(
                'active',
                index === activeIndex
              );

            }
          );


          items[activeIndex].scrollIntoView({
            block: 'nearest'
          });

        }


        /* ---------- END ---------- */

        else if (
          event.key === 'End'
        ) {

          event.preventDefault();

          activeIndex =
            items.length - 1;


          items.forEach(
            (item, index) => {

              item.classList.toggle(
                'active',
                index === activeIndex
              );

            }
          );


          items[activeIndex].scrollIntoView({
            block: 'nearest'
          });

        }


        /* ---------- ENTER ---------- */

        else if (
          event.key === 'Enter' &&
          activeIndex >= 0
        ) {

          event.preventDefault();


          authTargetJob.value =
            items[activeIndex].textContent;


          hideJobResults();

        }


        /* ---------- ESCAPE ---------- */

        else if (
          event.key === 'Escape'
        ) {

          event.preventDefault();

          hideJobResults();

        }

      }
    );


    /* -------------------------------------------------------
       CLICK OUTSIDE
       ------------------------------------------------------- */

    document.addEventListener(
      'click',
      (event) => {

        if (
          !event.target.closest(
            '#targetJobAutocomplete'
          )
        ) {

          hideJobResults();

        }

      }
    );

  }


  /* =========================================================
     LOAD REFERENCE DATA
     ========================================================= */

  async function loadReferenceData() {

    try {

      /* ---------- LOAD SCHOOLS ---------- */

      const schoolResponse =
        await fetch(
          '/api/reference/schools'
        );


      if (!schoolResponse.ok) {

        throw new Error(
          'Failed to load schools.'
        );

      }


      const schoolResponseData =
        await schoolResponse.json();


      if (
        schoolResponseData.success &&
        Array.isArray(
          schoolResponseData.schools
        )
      ) {

        schoolData =
          schoolResponseData.schools;

      }


      /* ---------- LOAD DEGREES ---------- */

      const degreeResponse =
        await fetch(
          '/api/reference/degrees'
        );


      if (!degreeResponse.ok) {

        throw new Error(
          'Failed to load degrees.'
        );

      }


      const degreeResponseData =
        await degreeResponse.json();


      if (
        degreeResponseData.success &&
        Array.isArray(
          degreeResponseData.degrees
        )
      ) {

        degreeData =
          degreeResponseData.degrees;

      }


      console.log(
        '[reference] Schools loaded:',
        schoolData.length
      );


      console.log(
        '[reference] Degrees loaded:',
        degreeData.length
      );

    } catch (error) {

      console.error(
        '[reference] Failed to load reference data:',
        error
      );

    }

  }


  /* =========================================================
     INITIALIZE AUTOCOMPLETE
     ========================================================= */

  setupAutocomplete(
    authEducation,
    schoolResults,

    () => schoolData,

    (school) => school.name

  );


  setupAutocomplete(
    authDegree,
    degreeResults,

    () => degreeData,

    (degree) => degree.name,

    (selectedDegree) => {

      /*
       * Only load related jobs after
       * the user actually selects a degree.
       */

      loadJobsForDegree(
        selectedDegree.name
      );

    }

  );


  /*
   * Initialize Target Job autocomplete.
   */

  setupTargetJobAutocomplete();


  /*
   * Load the API data when the page starts.
   */

  loadReferenceData();


  /* =========================================================
     AUTH MESSAGE
     ========================================================= */

  function showAuthMessage(message, type = 'error') {

    authMessage.textContent =
      message;

    authMessage.className =
      `auth-message show ${type}`;

  }


  function clearAuthMessage() {

    authMessage.textContent =
      '';

    authMessage.className =
      'auth-message';

  }


  /* =========================================================
     SHOW SIGNUP STEP
     ========================================================= */

  function showSignupStep(step) {

    signupStep = step;

    clearAuthMessage();


    if (step === 1) {

      signupStep1.style.display =
        'block';

      signupStep2.style.display =
        'none';


      authTitle.textContent =
        'Create your account';


      authSubtitle.textContent =
        'Sign up and start building your future.';


      authSubmit.textContent =
        'Continue';


      authSubmit.disabled =
        false;


      setTimeout(() => {

        authFullName.focus();

      }, 50);

    } else {

      signupStep1.style.display =
        'none';

      signupStep2.style.display =
        'block';


      authTitle.textContent =
        'Tell us about yourself';


      authSubtitle.textContent =
        'Help us personalize your career path.';


      authSubmit.textContent =
        'Sign Up';


      authSubmit.disabled =
        false;


      setTimeout(() => {

        authEducation.focus();

      }, 50);

    }

  }


  /* =========================================================
     SET AUTH MODE
     ========================================================= */

  function setAuthMode(mode) {

    authMode = mode;

    clearAuthMessage();

    authForm.reset();

    signupStep = 1;


    /*
     * Reset Target Job whenever the auth form
     * is switched between Login and Sign Up.
     */

    jobData = [];

    authTargetJob.disabled =
      true;

    authTargetJob.placeholder =
      'Select your degree first...';

    jobResults.classList.remove(
      'show'
    );

    jobResults.innerHTML = '';


    /* ---------- LOGIN ---------- */

    if (mode === 'login') {

      authTitle.textContent =
        'Log In';


      authSubtitle.textContent =
        'Welcome back! Log in to continue.';


      authSubmit.textContent =
        'Log In';


      authSubmit.disabled =
        false;


      authSwitchText.textContent =
        "Don't have an account?";


      authSwitch.textContent =
        'Sign Up';


      loginFields.style.display =
        'block';


      signupStep1.style.display =
        'none';


      signupStep2.style.display =
        'none';


      authEmailLogin.required =
        true;

      authPasswordLogin.required =
        true;


      authFullName.required =
        false;

      authConfirmPassword.required =
        false;


      authEducation.required =
        false;

      authDegree.required =
        false;

      authTargetJob.required =
        false;

      authLocation.required =
        false;


      authPasswordLogin.autocomplete =
        'current-password';


      setTimeout(() => {

        authEmailLogin.focus();

      }, 50);

    }


    /* ---------- SIGN UP ---------- */

    else {

      authSwitchText.textContent =
        'Already have an account?';


      authSwitch.textContent =
        'Log In';


      loginFields.style.display =
        'none';


      authEmailLogin.required =
        false;

      authPasswordLogin.required =
        false;


      authFullName.required =
        true;

      authConfirmPassword.required =
        true;


      authEducation.required =
        false;

      authDegree.required =
        false;

      authTargetJob.required =
        false;

      authLocation.required =
        false;


      authPassword.autocomplete =
        'new-password';


      showSignupStep(1);

    }

  }


  /* =========================================================
     OPEN AUTH
     ========================================================= */

  function openAuth(mode = 'login') {

    setAuthMode(mode);

    authOverlay.classList.add('active');

    document.body.style.overflow =
      'hidden';


    setTimeout(() => {

      if (mode === 'login') {

        authEmailLogin.focus();

      } else {

        authFullName.focus();

      }

    }, 100);

  }


  /* =========================================================
     CLOSE AUTH
     ========================================================= */

  function closeAuth() {

    authOverlay.classList.remove('active');

    document.body.style.overflow =
      '';

    clearAuthMessage();

  }


  /* =========================================================
     LOGIN BUTTON
     ========================================================= */

  const loginLink =
    $('.login-link');


  if (loginLink) {

    loginLink.addEventListener(
      'click',
      (event) => {

        event.preventDefault();

        openAuth('login');

      }
    );

  }


  /* =========================================================
     SIGN UP BUTTON
     ========================================================= */

  const signupButton =
    $('.header-actions .btn-primary');


  if (signupButton) {

    signupButton.addEventListener(
      'click',
      (event) => {

        event.preventDefault();

        openAuth('signup');

      }
    );

  }


  /* =========================================================
     CREATE YOUR ACCOUNT BUTTON
     ========================================================= */

  const createAccountButton =
    $('.cta-inner .btn-amber');


  if (createAccountButton) {

    createAccountButton.addEventListener(
      'click',
      (event) => {

        event.preventDefault();

        openAuth('signup');

      }
    );

  }


  /* =========================================================
     SWITCH LOGIN / SIGN UP
     ========================================================= */

  if (authSwitch) {

    authSwitch.addEventListener(
      'click',
      () => {

        if (authMode === 'login') {

          setAuthMode('signup');

        } else {

          setAuthMode('login');

        }

      }
    );

  }


  /* =========================================================
     SIGNUP BACK BUTTON
     ========================================================= */

  if (signupBack) {

    signupBack.addEventListener(
      'click',
      () => {

        showSignupStep(1);

      }
    );

  }


  /* =========================================================
     CLOSE MODAL BUTTON
     ========================================================= */

  if (authClose) {

    authClose.addEventListener(
      'click',
      closeAuth
    );

  }


  /* =========================================================
     CLOSE MODAL BY CLICKING OUTSIDE
     ========================================================= */

  if (authOverlay) {

    authOverlay.addEventListener(
      'click',
      (event) => {

        if (
          event.target === authOverlay
        ) {

          closeAuth();

        }

      }
    );

  }


  /* =========================================================
     CLOSE MODAL WITH ESCAPE
     ========================================================= */

  document.addEventListener(
    'keydown',
    (event) => {

      if (
        event.key === 'Escape' &&
        authOverlay.classList.contains('active')
      ) {

        closeAuth();

      }

    }
  );


  /* =========================================================
     AUTH FORM SUBMIT
     ========================================================= */

  if (authForm) {

    authForm.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();

        clearAuthMessage();


        /* =================================================
           SIGN UP STEP 1 → STEP 2
           ================================================= */

        if (
          authMode === 'signup' &&
          signupStep === 1
        ) {

          const fullName =
            authFullName.value.trim();


          const email =
            authEmail.value.trim();


          const password =
            authPassword.value;


          const confirmPassword =
            authConfirmPassword.value;


          if (!fullName) {

            showAuthMessage(
              'Please enter your full name.',
              'error'
            );

            authFullName.focus();

            return;

          }


          if (!email) {

            showAuthMessage(
              'Please enter your email.',
              'error'
            );

            authEmail.focus();

            return;

          }


          if (!authEmail.checkValidity()) {

            showAuthMessage(
              'Please enter a valid email address.',
              'error'
            );

            authEmail.focus();

            return;

          }


          if (!password) {

            showAuthMessage(
              'Please enter a password.',
              'error'
            );

            authPassword.focus();

            return;

          }


          if (password.length < 6) {

            showAuthMessage(
              'Password must be at least 6 characters.',
              'error'
            );

            authPassword.focus();

            return;

          }


          if (!confirmPassword) {

            showAuthMessage(
              'Please confirm your password.',
              'error'
            );

            authConfirmPassword.focus();

            return;

          }


          if (password !== confirmPassword) {

            showAuthMessage(
              'Passwords do not match.',
              'error'
            );

            authConfirmPassword.focus();

            return;

          }


          /* Move to profile information */

          showSignupStep(2);

          return;

        }


        /* =================================================
           SIGN UP STEP 2 VALIDATION
           ================================================= */

        if (
          authMode === 'signup' &&
          signupStep === 2
        ) {

          const education =
            authEducation.value.trim();


          const degree =
            authDegree.value.trim();


          const targetJob =
            authTargetJob.value.trim();


          const location =
            authLocation.value.trim();


          if (!education) {

            showAuthMessage(
              'Please enter your education.',
              'error'
            );

            authEducation.focus();

            return;

          }


          if (!degree) {

            showAuthMessage(
              'Please enter your degree.',
              'error'
            );

            authDegree.focus();

            return;

          }


          if (!targetJob) {

            showAuthMessage(
              'Please enter your target job.',
              'error'
            );

            authTargetJob.focus();

            return;

          }


          if (!location) {

            showAuthMessage(
              'Please enter your location.',
              'error'
            );

            authLocation.focus();

            return;

          }

        }


        /* =================================================
           DISABLE BUTTON
           ================================================= */

        authSubmit.disabled =
          true;


        authSubmit.textContent =
          authMode === 'login'
            ? 'Logging in...'
            : 'Creating account...';


        try {

          /* ---------- ENDPOINT ---------- */

          const endpoint =
            authMode === 'login'
              ? '/api/auth/login'
              : '/api/auth/register';


          /* ---------- REQUEST BODY ---------- */

          let body;


          if (authMode === 'login') {

            body = {

              email:
                authEmailLogin.value.trim(),

              password:
                authPasswordLogin.value

            };

          } else {

            body = {

              fullName:
                authFullName.value.trim(),

              email:
                authEmail.value.trim(),

              password:
                authPassword.value,

              confirmPassword:
                authConfirmPassword.value,

              education:
                authEducation.value.trim(),

              degree:
                authDegree.value.trim(),

              targetJob:
                authTargetJob.value.trim(),

              location:
                authLocation.value.trim()

            };

          }


          /* ---------- SEND REQUEST ---------- */

          const response =
            await fetch(
              endpoint,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json'
                },

                credentials: 'include',

                body:
                  JSON.stringify(body)

              }
            );


          const data =
            await response.json();


          /* ---------- ERROR ---------- */

          if (!response.ok) {

            throw new Error(
              data.message ||
              data.error ||
              'Something went wrong.'
            );

          }


          /* =================================================
             SUCCESS
             ================================================= */

          if (authMode === 'login') {

            showAuthMessage(
              'Login successful! Welcome back.',
              'success'
            );


            authSubmit.textContent =
              'Success!';


            setTimeout(() => {

              closeAuth();

              updateHeaderAfterLogin(
                data
              );

            }, 700);

          } else {

            showAuthMessage(
              'Account created successfully!',
              'success'
            );


            authSubmit.textContent =
              'Success!';


            setTimeout(() => {

              closeAuth();

              updateHeaderAfterLogin(
                data
              );

            }, 700);

          }


        } catch (error) {

          console.error(
            'Authentication error:',
            error
          );


          showAuthMessage(
            error.message ||
            'Authentication failed.',
            'error'
          );


        } finally {

          setTimeout(() => {

            authSubmit.disabled =
              false;


            if (
              authMode === 'login'
            ) {

              authSubmit.textContent =
                'Log In';

            } else if (
              signupStep === 1
            ) {

              authSubmit.textContent =
                'Continue';

            } else {

              authSubmit.textContent =
                'Sign Up';

            }

          }, 800);

        }

      }
    );

  }


  /* =========================================================
     UPDATE HEADER AFTER LOGIN
     ========================================================= */

  function updateHeaderAfterLogin(data) {

    const actions =
      $('.header-actions');


    if (!actions) return;


    const fullName =
      data.fullName ||
      data.user?.full_name ||
      data.user?.fullName ||
      'Account';


    actions.innerHTML = `

      <span
        class="login-link"
        style="cursor: default;"
      >
        👋 ${fullName}
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
      $('#logoutButton');


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


  /* =========================================================
     CHECK EXISTING LOGIN SESSION
     ========================================================= */

  async function checkCurrentUser() {

    try {

      const response =
        await fetch(
          '/api/auth/me',
          {
            credentials: 'include'
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


  checkCurrentUser();


  /* =========================================================
     JOB RESULTS
     ========================================================= */

  const resultsSection =
    $('#resultsSection');


  const resultsGrid =
    $('#resultsGrid');


  const resultsTitle =
    $('#resultsTitle');


  const resultsClose =
    $('#resultsClose');


  function money(job) {

    return job.salary
      ? `<span>${job.salary}</span>`
      : '';

  }


  function renderJobs(
    jobs,
    heading
  ) {

    resultsTitle.textContent =
      heading;


    resultsGrid.innerHTML =
      '';


    if (!jobs.length) {

      resultsGrid.innerHTML =
        '<p class="results-empty">No jobs matched that search yet. Try a different keyword or category.</p>';

    } else {

      const frag =
        document.createDocumentFragment();


      jobs.forEach((job) => {

        const card =
          document.createElement(
            'article'
          );


        card.className =
          'result-card';


        card.innerHTML = `

          <h3>
            ${job.title}
          </h3>

          <p class="company">
            ${job.company || ''}
          </p>

          <div class="meta">

            <span>
              ${job.location || 'Remote'}
            </span>

            ${
              job.employment_type
                ? `<span>${job.employment_type}</span>`
                : ''
            }

            ${money(job)}

          </div>

          ${
            typeof job.matchScore === 'number'
              ? `<span class="match">${job.matchScore}% match</span>`
              : ''
          }

        `;


        frag.appendChild(card);

      });


      resultsGrid.appendChild(
        frag
      );

    }


    resultsSection.hidden =
      false;


    resultsSection.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

  }


  /* =========================================================
     FETCH JOBS
     ========================================================= */

  async function fetchJobs(params) {

    const query =
      new URLSearchParams(params)
        .toString();


    const res =
      await fetch(
        `/api/jobs${query ? `?${query}` : ''}`
      );


    if (!res.ok) {

      throw new Error(
        'Failed to load jobs'
      );

    }


    const data =
      await res.json();


    return data.jobs || [];

  }


  /* =========================================================
     RUN SEARCH
     ========================================================= */

  async function runSearch(
    params,
    heading
  ) {

    resultsGrid.innerHTML =
      '<p class="results-empty">Loading jobs…</p>';


    resultsSection.hidden =
      false;


    resultsSection.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });


    try {

      const jobs =
        await fetchJobs(
          params
        );


      renderJobs(
        jobs,
        heading
      );

    } catch (err) {

      resultsGrid.innerHTML =
        '<p class="results-empty">Something went wrong loading jobs. Please try again.</p>';


      console.error(err);

    }

  }


  /* =========================================================
     CLOSE RESULTS
     ========================================================= */

  if (resultsClose) {

    resultsClose.addEventListener(
      'click',
      () => {

        resultsSection.hidden =
          true;

      }
    );

  }


  /* =========================================================
     SEARCH
     ========================================================= */

  const searchForm =
    $('#searchForm');


  if (searchForm) {

    searchForm.addEventListener(
      'submit',
      (e) => {

        e.preventDefault();


        const q =
          $('#searchQuery')
            .value
            .trim();


        const location =
          $('#searchLocation')
            .value
            .trim();


        runSearch(

          {
            q,
            location
          },

          q
            ? `Results for “${q}”`
            : 'All jobs'

        );

      }
    );

  }


  /* =========================================================
     POPULAR SEARCH CHIPS
     ========================================================= */

  $$('.chip').forEach((chip) => {

    chip.addEventListener(
      'click',
      () => {

        const query =
          chip.dataset.query;


        $('#searchQuery').value =
          query;


        runSearch(

          {
            q: query
          },

          `Results for “${query}”`

        );

      }
    );

  });


  /* =========================================================
     CATEGORY SEARCH
     ========================================================= */

  $$('.category-card').forEach((card) => {

    card.addEventListener(
      'click',
      () => {

        const category =
          card.dataset.category;


        runSearch(

          {
            category
          },

          category

        );

      }
    );

  });


})();