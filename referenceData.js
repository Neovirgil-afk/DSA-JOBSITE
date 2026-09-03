/*
=========================================================
JOBPATH REFERENCE DATA
=========================================================

This file contains reference information used by the
signup form.

Current sections:
1. Philippine schools - Region IV-A / CALABARZON only
2. Region IV-A / CALABARZON locations
3. Degree / program categories

School data for Region IV-A is stored separately in:
    /data/region4aSchools.json

Location data for Region IV-A is stored separately in:
    /data/region4aLocations.json

=========================================================
*/


/* =========================================================
   REGION IV-A / CALABARZON SCHOOLS
   ========================================================= */

const region4aSchools =
    require('./data/region4aSchools.json');


/* =========================================================
   REGION IV-A / CALABARZON LOCATIONS
   ========================================================= */

const region4aLocations =
    require('./data/region4aLocations.json');


/* =========================================================
   SCHOOL DATA
   ========================================================= */

const allSchools = [
    ...region4aSchools
];


/* =========================================================
   LOCATION DATA
   ========================================================= */

const allLocations = [
    ...region4aLocations
];


/* =========================================================
   DEGREE / PROGRAM CATEGORIES
   ========================================================= */

const degrees = [

    /* =========================
       COMPUTER / INFORMATION TECHNOLOGY
       ========================= */

    {
        name: 'Bachelor of Science in Computer Engineering',
        category: 'Computer Engineering'
    },

    {
        name: 'Bachelor of Science in Computer Science',
        category: 'Computer Science'
    },

    {
        name: 'Bachelor of Science in Information Technology',
        category: 'Information Technology'
    },

    {
        name: 'Bachelor of Science in Information Systems',
        category: 'Information Systems'
    },

    {
        name: 'Bachelor of Science in Data Science',
        category: 'Data Science'
    },

    {
        name: 'Bachelor of Science in Cybersecurity',
        category: 'Cybersecurity'
    },


    /* =========================
       ENGINEERING
       ========================= */

    {
        name: 'Bachelor of Science in Electronics Engineering',
        category: 'Electronics Engineering'
    },

    {
        name: 'Bachelor of Science in Electrical Engineering',
        category: 'Electrical Engineering'
    },

    {
        name: 'Bachelor of Science in Mechanical Engineering',
        category: 'Mechanical Engineering'
    },

    {
        name: 'Bachelor of Science in Civil Engineering',
        category: 'Civil Engineering'
    },

    {
        name: 'Bachelor of Science in Industrial Engineering',
        category: 'Industrial Engineering'
    },

    {
        name: 'Bachelor of Science in Chemical Engineering',
        category: 'Chemical Engineering'
    },

    {
        name: 'Bachelor of Science in Environmental Engineering',
        category: 'Environmental Engineering'
    },


    /* =========================
       BUSINESS
       ========================= */

    {
        name: 'Bachelor of Science in Business Administration',
        category: 'Business Administration'
    },

    {
        name: 'Bachelor of Science in Accountancy',
        category: 'Accountancy'
    },

    {
        name: 'Bachelor of Science in Management Accounting',
        category: 'Management Accounting'
    },

    {
        name: 'Bachelor of Science in Entrepreneurship',
        category: 'Entrepreneurship'
    },

    {
        name: 'Bachelor of Science in Marketing',
        category: 'Marketing'
    },

    {
        name: 'Bachelor of Science in Human Resource Management',
        category: 'Human Resource Management'
    },


    /* =========================
       HEALTH
       ========================= */

    {
        name: 'Bachelor of Science in Nursing',
        category: 'Nursing'
    },

    {
        name: 'Bachelor of Science in Medical Technology',
        category: 'Medical Technology'
    },

    {
        name: 'Bachelor of Science in Pharmacy',
        category: 'Pharmacy'
    },

    {
        name: 'Bachelor of Science in Physical Therapy',
        category: 'Physical Therapy'
    },

    {
        name: 'Bachelor of Science in Psychology',
        category: 'Psychology'
    },


    /* =========================
       EDUCATION
       ========================= */

    {
        name: 'Bachelor of Elementary Education',
        category: 'Elementary Education'
    },

    {
        name: 'Bachelor of Secondary Education',
        category: 'Secondary Education'
    },

    {
        name: 'Bachelor of Early Childhood Education',
        category: 'Early Childhood Education'
    },


    /* =========================
       COMMUNICATION / ARTS
       ========================= */

    {
        name: 'Bachelor of Arts in Communication',
        category: 'Communication'
    },

    {
        name: 'Bachelor of Arts in Political Science',
        category: 'Political Science'
    },

    {
        name: 'Bachelor of Arts in Psychology',
        category: 'Psychology'
    },

    {
        name: 'Bachelor of Arts in English',
        category: 'English'
    },


    /* =========================
       HOSPITALITY
       ========================= */

    {
        name: 'Bachelor of Science in Hospitality Management',
        category: 'Hospitality Management'
    },

    {
        name: 'Bachelor of Science in Tourism Management',
        category: 'Tourism Management'
    },


    /* =========================
       CRIMINOLOGY
       ========================= */

    {
        name: 'Bachelor of Science in Criminology',
        category: 'Criminology'
    },


    /* =========================
       AGRICULTURE
       ========================= */

    {
        name: 'Bachelor of Science in Agriculture',
        category: 'Agriculture'
    },

    {
        name: 'Bachelor of Science in Agricultural Engineering',
        category: 'Agricultural Engineering'
    },


    /* =========================
       LIBRARY / INFORMATION
       ========================= */

    {
        name: 'Bachelor of Library and Information Science',
        category: 'Library and Information Science'
    },

    {
        name: 'Bachelor of Science in Office Administration',
        category: 'Office Administration'
    }

];


/* =========================================================
   EXPORT
   ========================================================= */

module.exports = {
    schools: allSchools,
    locations: allLocations,
    degrees
};