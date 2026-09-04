'use strict';

require('dotenv').config({ override: true });

const PSA_BASE_URL =
    'https://classification.psa.gov.ph/psgc';

const PSA_VERSION =
    process.env.PSA_PSGC_VERSION || 'Q2_2024';

const PSA_API_TOKEN =
    process.env.PSA_API_TOKEN || '';

/*
 * Cache locations in memory.
 *
 * We don't want to call PSA every time a user
 * types one character into the location field.
 */

let locationCache = [];

let cacheLoadedAt = 0;

const CACHE_DURATION =
    24 * 60 * 60 * 1000;


/* =========================================================
   CHECK CONFIGURATION
   ========================================================= */

function checkConfiguration() {

    if (!PSA_API_TOKEN) {

        throw new Error(
            'PSA_API_TOKEN is not configured.'
        );

    }

}


/* =========================================================
   FETCH ONE PSA PAGE
   ========================================================= */

async function fetchPSAPage(url) {

    const response =
        await fetch(url);

    if (!response.ok) {

        const text =
            await response.text();

        throw new Error(
            `PSA API request failed: ${response.status} ${response.statusText} - ${text.slice(0, 300)}`
        );

    }

    return response.json();

}


/* =========================================================
   FETCH ALL PAGINATED PSA RESULTS
   ========================================================= */

async function fetchAllPSAResults(
    endpoint
) {

    checkConfiguration();

    const firstUrl =
        new URL(
            `${PSA_BASE_URL}/${PSA_VERSION}/${endpoint}`
        );

    firstUrl.searchParams.set(
        'token',
        PSA_API_TOKEN
    );

    /*
     * Ask for a large page size.
     *
     * If PSA ignores this parameter, we still
     * follow the "next" URL returned by the API.
     */

    firstUrl.searchParams.set(
        'page_size',
        '1000'
    );

    const results = [];

    let nextUrl =
        firstUrl.toString();

    let pageNumber = 1;

    while (nextUrl) {

        console.log(
            `[PSA] Fetching ${endpoint} page ${pageNumber}...`
        );

        const data =
            await fetchPSAPage(
                nextUrl
            );

        if (
            Array.isArray(
                data.results
            )
        ) {

            results.push(
                ...data.results
            );

        }

        /*
         * PSA returns the URL of the next page.
         *
         * If there is no next page, this becomes null.
         */

        nextUrl =
            data.next || null;

        pageNumber++;

        /*
         * Safety protection against a broken API
         * repeatedly returning the same page.
         */

        if (
            pageNumber > 100
        ) {

            throw new Error(
                `PSA ${endpoint} pagination exceeded 100 pages.`
            );

        }

    }

    return results;

}


/* =========================================================
   CLEAN LOCATION NAME
   ========================================================= */

function cleanLocationName(name) {

    if (!name) {

        return '';

    }

    let cleaned =
        String(name).trim();


    /*
     * Remove "City of" from PSA city names.
     *
     * Example:
     *
     * City of Bacoor
     * ↓
     * Bacoor
     */

    cleaned =
        cleaned.replace(
            /^City of\s+/i,
            ''
        );


    /*
     * Remove extra spaces.
     *
     * Example:
     *
     * "Trece Martires  "
     * ↓
     * "Trece Martires"
     */

    cleaned =
        cleaned.replace(
            /\s+/g,
            ' '
        )
        .trim();


    /*
     * Fix PSA abbreviated municipality names.
     */

    if (
        cleaned ===
        'Gen. Mariano Alvarez'
    ) {

        cleaned =
            'General Mariano Alvarez';

    }


    /*
     * Fix common UTF-8 encoding corruption.
     *
     * Example:
     *
     * DasmariÃ±as
     * ↓
     * Dasmariñas
     */

    try {

        if (
            cleaned.includes('Ã')
        ) {

            cleaned =
                Buffer.from(
                    cleaned,
                    'latin1'
                ).toString(
                    'utf8'
                );

        }

    } catch (error) {

        console.warn(
            '[PSA] Could not repair location encoding:',
            cleaned
        );

    }


    return cleaned;

}


/* =========================================================
   NORMALIZE PSA LOCATION
   ========================================================= */

function normalizeLocation(
    municipality,
    provinceMap,
    regionMap
) {

    const province =
        provinceMap.get(
            Number(municipality.prv)
        ) || '';


    const region =
        regionMap.get(
            Number(municipality.reg)
        ) || '';


    /*
     * PSA's municipalities endpoint contains
     * both municipalities and cities.
     *
     * Cities generally have a city_class value.
     */

    const type =
        municipality.city_class
            ? 'City'
            : 'Municipality';


    return {

        /*
         * Clean the raw PSA location name
         * before sending it to the frontend.
         */

        name:
            cleanLocationName(
                municipality.area_name
            ),

        type,

        province,

        region,

        code:
            municipality.code || '',

        correspondence_code:
            municipality.correspondence_code || '',

        reg:
            municipality.reg,

        prv:
            municipality.prv,

        mun:
            municipality.mun

    };

}


/* =========================================================
   LOAD ALL LOCATIONS
   ========================================================= */

async function loadLocationsFromPSA() {

    console.log(
        `[PSA] Loading Philippine locations from ${PSA_VERSION}...`
    );


    /*
     * Fetch regions, provinces, and municipalities
     * at the same time.
     *
     * Municipality records contain numeric
     * region/province codes, so we need the
     * other two datasets to translate them.
     */

    const [
        regions,
        provinces,
        municipalities
    ] = await Promise.all([

        fetchAllPSAResults(
            'regions'
        ),

        fetchAllPSAResults(
            'provinces'
        ),

        fetchAllPSAResults(
            'municipalities'
        )

    ]);


    /* =====================================================
       REGION LOOKUP
       ===================================================== */

    const regionMap =
        new Map();

    regions.forEach(
        (region) => {

            const code =
                Number(region.reg);

            const name =
                region.area_name || '';

            if (
                Number.isFinite(code) &&
                name
            ) {

                regionMap.set(
                    code,
                    name
                );

            }

        }
    );


    /* =====================================================
       PROVINCE LOOKUP
       ===================================================== */

    const provinceMap =
        new Map();

    provinces.forEach(
        (province) => {

            const code =
                Number(province.prv);

            const name =
                province.area_name || '';

            if (
                Number.isFinite(code) &&
                name
            ) {

                provinceMap.set(
                    code,
                    name
                );

            }

        }
    );


    /* =====================================================
       NORMALIZE ALL MUNICIPALITY/CITY RECORDS
       ===================================================== */

    /*
     * IMPORTANT:
     *
     * Do NOT filter using:
     *
     * municipality.geographic_level === 'Mun'
     *
     * The PSA /municipalities endpoint already provides
     * the LGU records we need.
     *
     * Filtering previously caused some records to disappear.
     */

    const locations =
        municipalities
            .map(
                (municipality) =>
                    normalizeLocation(
                        municipality,
                        provinceMap,
                        regionMap
                    )
            )
            .filter(
                (location) =>
                    location.name
            )
            .sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );


    /* =====================================================
       GENERAL DEBUG INFORMATION
       ===================================================== */

    console.log(
        `[PSA] Regions loaded: ${regions.length}`
    );

    console.log(
        `[PSA] Provinces loaded: ${provinces.length}`
    );

    console.log(
        `[PSA] Municipalities loaded: ${municipalities.length}`
    );

    console.log(
        `[PSA] Locations ready: ${locations.length}`
    );


    /* =====================================================
       CAVITE DEBUG
       ===================================================== */

    /*
     * Cavite province code:
     *
     * 21
     *
     * This diagnostic shows exactly which Cavite
     * locations were returned and normalized.
     */

    const caviteRecords =
        locations.filter(
            (location) =>
                Number(location.prv) === 21
        );


    console.log(
        `[PSA] Cavite locations found: ${caviteRecords.length}`
    );


    console.log(
        '[PSA] Cavite locations:',
        caviteRecords.map(
            (location) =>
                `${location.name} (${location.type})`
        )
    );


    return locations;

}


/* =========================================================
   GET LOCATIONS
   ========================================================= */

async function getLocations() {

    const now =
        Date.now();


    const cacheIsValid =
        locationCache.length > 0 &&
        now - cacheLoadedAt <
            CACHE_DURATION;


    if (cacheIsValid) {

        return locationCache;

    }


    /*
     * Prevent two simultaneous requests from
     * downloading the entire PSA dataset twice.
     */

    if (
        getLocations.loadingPromise
    ) {

        return getLocations.loadingPromise;

    }


    getLocations.loadingPromise =
        loadLocationsFromPSA()
            .then(
                (locations) => {

                    locationCache =
                        locations;

                    cacheLoadedAt =
                        Date.now();

                    return locationCache;

                }
            )
            .finally(
                () => {

                    getLocations.loadingPromise =
                        null;

                }
            );


    return getLocations.loadingPromise;

}


/* =========================================================
   CLEAR CACHE
   ========================================================= */

function clearLocationCache() {

    locationCache = [];

    cacheLoadedAt = 0;

}


/* =========================================================
   EXPORT
   ========================================================= */

module.exports = {

    getLocations,

    clearLocationCache

};