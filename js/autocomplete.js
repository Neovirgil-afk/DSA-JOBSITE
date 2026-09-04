'use strict';


/* =========================================================
   AUTOCOMPLETE STYLES
   ========================================================= */

function addAutocompleteStyles() {

    if (document.getElementById('autocompleteStyles')) {
        return;
    }

    const style = document.createElement('style');

    style.id = 'autocompleteStyles';

    style.textContent = `

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

            max-height: 300px;

            overflow-y: auto;
            overflow-x: hidden;

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

    document.head.appendChild(style);
}


/* =========================================================
   GENERIC AUTOCOMPLETE
   ========================================================= */

function setupAutocomplete(
    input,
    resultsContainer,
    getData,
    getLabel,
    onSelect = null
) {

    let activeIndex = -1;


    function hideResults() {

        resultsContainer.classList.remove('show');

        resultsContainer.innerHTML = '';

        activeIndex = -1;
    }


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


    function selectItem(item) {

        input.value =
            getLabel(item);

        hideResults();

        input.focus();

        if (typeof onSelect === 'function') {

            onSelect(item);
        }
    }


    function showResults() {

        const query =
            input.value.trim().toLowerCase();

        if (!query) {

            hideResults();

            return;
        }


        const data =
            getData();


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


        matches.forEach((item, index) => {

            const result =
                document.createElement('div');

            result.className =
                'autocomplete-item';

            result.setAttribute(
                'role',
                'option'
            );

            result.dataset.index =
                index;

            result.textContent =
                getLabel(item);


            result.addEventListener(
                'mousedown',
                (event) => {

                    event.preventDefault();

                    selectItem(item);
                }
            );


            resultsContainer.appendChild(result);
        });


        resultsContainer.classList.add('show');

        activeIndex = -1;
    }


    input.addEventListener(
        'input',
        showResults
    );


    input.addEventListener(
        'focus',
        () => {

            if (input.value.trim()) {

                showResults();
            }
        }
    );


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


            else if (event.key === 'ArrowUp') {

                event.preventDefault();

                activeIndex--;

                if (activeIndex < 0) {

                    activeIndex =
                        items.length - 1;
                }

                updateActiveItem();

            }


            else if (event.key === 'Home') {

                event.preventDefault();

                activeIndex = 0;

                updateActiveItem();

            }


            else if (event.key === 'End') {

                event.preventDefault();

                activeIndex =
                    items.length - 1;

                updateActiveItem();

            }


            else if (
                event.key === 'Enter' &&
                activeIndex >= 0
            ) {

                event.preventDefault();

                const selectedLabel =
                    items[activeIndex].textContent;

                const data =
                    getData();

                const selectedItem =
                    data.find(
                        (item) =>
                            getLabel(item) ===
                            selectedLabel
                    );

                if (selectedItem) {

                    selectItem(selectedItem);
                }
            }


            else if (event.key === 'Escape') {

                event.preventDefault();

                hideResults();
            }
        }
    );


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

function setupTargetJobAutocomplete(
    input,
    resultsContainer,
    getJobs
) {

    let activeIndex = -1;


    function hideResults() {

        resultsContainer.classList.remove('show');

        resultsContainer.innerHTML = '';

        activeIndex = -1;
    }


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


    function showResults() {

        const jobs =
            getJobs();


        const query =
            input.value.trim().toLowerCase();


        if (
            input.disabled ||
            !jobs.length
        ) {

            hideResults();

            return;
        }


        let matches = jobs;


        if (query) {

            const startsWithMatches =
                jobs.filter((job) =>
                    job.title
                        .toLowerCase()
                        .startsWith(query)
                );


            const containsMatches =
                jobs.filter((job) => {

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


        resultsContainer.innerHTML = '';


        if (!matches.length) {

            const empty =
                document.createElement('div');

            empty.className =
                'autocomplete-empty';

            empty.textContent =
                'No related jobs found';

            resultsContainer.appendChild(empty);

            resultsContainer.classList.add('show');

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

            result.dataset.index =
                index;

            result.textContent =
                job.title;


            result.addEventListener(
                'mousedown',
                (event) => {

                    event.preventDefault();

                    input.value =
                        job.title;

                    hideResults();

                    input.focus();
                }
            );


            resultsContainer.appendChild(result);
        });


        resultsContainer.classList.add('show');

        activeIndex = -1;
    }


    input.addEventListener(
        'input',
        showResults
    );


    input.addEventListener(
        'focus',
        () => {

            if (
                !input.disabled &&
                getJobs().length
            ) {

                showResults();
            }
        }
    );


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


            else if (event.key === 'ArrowUp') {

                event.preventDefault();

                activeIndex--;

                if (activeIndex < 0) {

                    activeIndex =
                        items.length - 1;
                }

                updateActiveItem();

            }


            else if (event.key === 'Home') {

                event.preventDefault();

                activeIndex = 0;

                updateActiveItem();

            }


            else if (event.key === 'End') {

                event.preventDefault();

                activeIndex =
                    items.length - 1;

                updateActiveItem();

            }


            else if (
                event.key === 'Enter' &&
                activeIndex >= 0
            ) {

                event.preventDefault();

                input.value =
                    items[activeIndex].textContent;

                hideResults();
            }


            else if (event.key === 'Escape') {

                event.preventDefault();

                hideResults();
            }
        }
    );


    document.addEventListener(
        'click',
        (event) => {

            if (
                !event.target.closest(
                    '#targetJobAutocomplete'
                )
            ) {

                hideResults();
            }
        }
    );
}


/* =========================================================
   INITIALIZE AUTOCOMPLETE
   ========================================================= */

export function initAutocomplete({

    educationInput,
    schoolResults,

    degreeInput,
    degreeResults,

    targetJobInput,
    jobResults,

    locationInput,
    locationResults,

    getSchools,
    getDegrees,
    getJobs,
    getLocations,

    onDegreeSelect

}) {

    addAutocompleteStyles();


    /* =====================================================
       EDUCATION / SCHOOL
       ===================================================== */

    setupAutocomplete(
        educationInput,
        schoolResults,
        getSchools,
        (school) => school.name
    );


    /* =====================================================
       DEGREE
       ===================================================== */

    setupAutocomplete(
        degreeInput,
        degreeResults,
        getDegrees,
        (degree) => degree.name,
        onDegreeSelect
    );


    /* =====================================================
       LOCATION
       ===================================================== */

    setupAutocomplete(
        locationInput,
        locationResults,
        getLocations,
        (location) =>
            location.province
                ? `${location.name}, ${location.province}`
                : location.name
    );


    /* =====================================================
       TARGET JOB
       ===================================================== */

    setupTargetJobAutocomplete(
        targetJobInput,
        jobResults,
        getJobs
    );
}