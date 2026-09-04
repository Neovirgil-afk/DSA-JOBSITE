'use strict';

const express = require('express');

const {
    schools,
    degrees
} = require('./referenceData');

const { db } =
    require('./database');

const {
    getLocations
} = require('./psgcService');

const router =
    express.Router();


/* =========================================================
   DEGREE → JOB CATEGORY MAPPING
   ========================================================= */

const DEGREE_JOB_CATEGORIES = {

    technology: [
        'IT & Software',
        'Data',
        'Cybersecurity'
    ],

    computer: [
        'IT & Software',
        'Data',
        'Cybersecurity'
    ],

    'information technology': [
        'IT & Software',
        'Data',
        'Cybersecurity'
    ],

    'information systems': [
        'IT & Software',
        'Data',
        'Cybersecurity'
    ],

    software: [
        'IT & Software',
        'Data'
    ],

    cybersecurity: [
        'Cybersecurity'
    ],

    'information security': [
        'Cybersecurity'
    ],

    data: [
        'Data'
    ],

    'computer engineering': [
        'IT & Software',
        'Data',
        'Cybersecurity'
    ],

    'electronics engineering': [
        'IT & Software'
    ],

    'electrical engineering': [
        'IT & Software'
    ],

    engineering: [
        'IT & Software',
        'Data'
    ],

    design: [
        'Design'
    ],

    multimedia: [
        'Design'
    ],

    business: [
        'Marketing'
    ],

    marketing: [
        'Marketing'
    ],

    management: [
        'Marketing'
    ]

};


function getJobCategoriesForDegree(
    degreeName
) {

    if (!degreeName) {

        return [];

    }

    const degree =
        degreeName
            .toLowerCase()
            .trim();

    const matchedCategories =
        new Set();


    for (
        const [
            keyword,
            categories
        ]
        of Object.entries(
            DEGREE_JOB_CATEGORIES
        )
    ) {

        if (
            degree.includes(
                keyword
            )
        ) {

            categories.forEach(
                (category) => {

                    matchedCategories.add(
                        category
                    );

                }
            );

        }

    }


    return [
        ...matchedCategories
    ];

}


/* =========================================================
   SCHOOLS
   ========================================================= */

router.get(
    '/schools',
    (req, res) => {

        try {

            res.json({

                success: true,

                schools: schools

            });

        } catch (error) {

            console.error(
                '[reference] schools error:',
                error
            );

            res.status(500).json({

                error:
                    'Failed to load schools.'

            });

        }

    }
);


/* =========================================================
   SCHOOL SEARCH
   ========================================================= */

router.get(
    '/schools/search',
    (req, res) => {

        try {

            const query =
                (req.query.q || '')
                    .trim()
                    .toLowerCase();


            if (!query) {

                return res.json({

                    success: true,

                    schools: schools

                });

            }


            const results =
                schools.filter(
                    (school) =>
                        school.name
                            .toLowerCase()
                            .includes(query)
                );


            res.json({

                success: true,

                schools: results

            });

        } catch (error) {

            console.error(
                '[reference] school search error:',
                error
            );

            res.status(500).json({

                error:
                    'Failed to search schools.'

            });

        }

    }
);


/* =========================================================
   DEGREES
   ========================================================= */

router.get(
    '/degrees',
    (req, res) => {

        try {

            res.json({

                success: true,

                degrees: degrees

            });

        } catch (error) {

            console.error(
                '[reference] degrees error:',
                error
            );

            res.status(500).json({

                error:
                    'Failed to load degrees.'

            });

        }

    }
);


/* =========================================================
   DEGREE SEARCH
   ========================================================= */

router.get(
    '/degrees/search',
    (req, res) => {

        try {

            const query =
                (req.query.q || '')
                    .trim()
                    .toLowerCase();


            if (!query) {

                return res.json({

                    success: true,

                    degrees: degrees

                });

            }


            const results =
                degrees.filter(
                    (degree) =>
                        degree.name
                            .toLowerCase()
                            .includes(query)
                );


            res.json({

                success: true,

                degrees: results

            });

        } catch (error) {

            console.error(
                '[reference] degree search error:',
                error
            );

            res.status(500).json({

                error:
                    'Failed to search degrees.'

            });

        }

    }
);


/* =========================================================
   LOCATIONS
   ========================================================= */

router.get(
    '/locations',
    async (req, res) => {

        try {

            const locations =
                await getLocations();


            res.json({

                success: true,

                locations: locations

            });

        } catch (error) {

            console.error(
                '[reference] PSA locations error:',
                error
            );


            res.status(500).json({

                success: false,

                error:
                    'Failed to load Philippine locations.'

            });

        }

    }
);


/* =========================================================
   LOCATION SEARCH
   ========================================================= */

router.get(
    '/locations/search',
    async (req, res) => {

        try {

            const query =
                (req.query.q || '')
                    .trim()
                    .toLowerCase();


            const locations =
                await getLocations();


            if (!query) {

                return res.json({

                    success: true,

                    locations: locations

                });

            }


            const results =
                locations.filter(
                    (location) => {

                        const name =
                            location.name
                                .toLowerCase();

                        const province =
                            location.province
                                .toLowerCase();

                        const region =
                            location.region
                                .toLowerCase();


                        return (
                            name.includes(query) ||
                            province.includes(query) ||
                            region.includes(query)
                        );

                    }
                );


            res.json({

                success: true,

                locations: results

            });

        } catch (error) {

            console.error(
                '[reference] PSA location search error:',
                error
            );


            res.status(500).json({

                success: false,

                error:
                    'Failed to search Philippine locations.'

            });

        }

    }
);


/* =========================================================
   JOBS RELATED TO DEGREE
   ========================================================= */

router.get(
    '/jobs',
    (req, res) => {

        try {

            const degree =
                (req.query.degree || '')
                    .trim();


            if (!degree) {

                return res.json({

                    success: true,

                    jobs: [],

                    categories: []

                });

            }


            const categories =
                getJobCategoriesForDegree(
                    degree
                );


            if (
                categories.length === 0
            ) {

                return res.json({

                    success: true,

                    jobs: [],

                    categories: []

                });

            }


            const placeholders =
                categories
                    .map(() => '?')
                    .join(', ');


            const jobs =
                db.prepare(`
                    SELECT
                        id,
                        title,
                        category
                    FROM jobs
                    WHERE category IN (${placeholders})
                    ORDER BY title ASC
                `)
                .all(
                    ...categories
                );


            res.json({

                success: true,

                jobs: jobs,

                categories:
                    categories

            });

        } catch (error) {

            console.error(
                '[reference] jobs error:',
                error
            );

            res.status(500).json({

                error:
                    'Failed to load jobs related to degree.'

            });

        }

    }
);


/* =========================================================
   REGIONS
   ========================================================= */

router.get(
    '/regions',
    (req, res) => {

        try {

            const regions =
                [
                    ...new Set(
                        schools.map(
                            (school) =>
                                school.region
                        )
                    )
                ]
                .sort();


            res.json({

                success: true,

                regions: regions

            });

        } catch (error) {

            console.error(
                '[reference] regions error:',
                error
            );

            res.status(500).json({

                error:
                    'Failed to load regions.'

            });

        }

    }
);


/* =========================================================
   PROVINCES
   ========================================================= */

router.get(
    '/provinces',
    (req, res) => {

        try {

            const region =
                (req.query.region || '')
                    .trim();


            let filteredSchools =
                schools;


            if (region) {

                filteredSchools =
                    schools.filter(
                        (school) =>
                            school.region ===
                            region
                    );

            }


            const provinces =
                [
                    ...new Set(
                        filteredSchools.map(
                            (school) =>
                                school.province
                        )
                    )
                ]
                .sort();


            res.json({

                success: true,

                provinces:
                    provinces

            });

        } catch (error) {

            console.error(
                '[reference] provinces error:',
                error
            );

            res.status(500).json({

                error:
                    'Failed to load provinces.'

            });

        }

    }
);


/* =========================================================
   EXPORT
   ========================================================= */

module.exports =
    router;
