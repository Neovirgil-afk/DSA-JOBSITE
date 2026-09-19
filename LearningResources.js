'use strict';

/*
 * Learning resources used by the Skill Gap feature.
 * YouTube entries intentionally use search pages instead of a single video
 * so the learner can choose the instructor and difficulty they prefer.
 */

const DEFAULT_RESOURCES = {
    youtube: (skill) => ({
        title: `Learn ${skill} on YouTube`,
        description: `Video tutorials, walkthroughs, and practice lessons for ${skill}.`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + ' tutorial for beginners')}`,
        provider: 'YouTube',
    }),
};

const RESOURCE_MAP = {
    HTML: [
        { type: 'article', title: 'MDN: HTML', description: 'Learn how to structure web pages with HTML.', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', provider: 'MDN' },
    ],
    CSS: [
        { type: 'article', title: 'MDN: CSS', description: 'Learn selectors, layout, responsive design, and styling.', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS', provider: 'MDN' },
    ],
    JavaScript: [
        { type: 'article', title: 'MDN: JavaScript Guide', description: 'A structured guide covering JavaScript fundamentals through advanced topics.', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', provider: 'MDN' },
    ],
    React: [
        { type: 'article', title: 'React Learn: Quick Start', description: 'Learn components, JSX, events, lists, and everyday React concepts.', url: 'https://react.dev/learn', provider: 'React' },
        { type: 'article', title: 'MDN: Getting started with React', description: 'Build a first React app while connecting React concepts to core web skills.', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Frameworks_libraries/React_getting_started', provider: 'MDN' },
    ],
    Git: [
        { type: 'article', title: 'Git Documentation', description: 'Official Git reference and guides for repositories, commits, branches, and more.', url: 'https://git-scm.com/doc', provider: 'Git' },
    ],
    SQL: [
        { type: 'article', title: 'SQLBolt', description: 'Interactive SQL lessons and exercises you can practice directly in the browser.', url: 'https://sqlbolt.com/', provider: 'SQLBolt' },
    ],
    Python: [
        { type: 'article', title: 'Python Tutorial', description: 'Official Python tutorial covering the language and core programming concepts.', url: 'https://docs.python.org/3/tutorial/', provider: 'Python' },
    ],
    Java: [
        { type: 'article', title: 'Dev.java Learn', description: 'Official Java learning material from the Java platform.', url: 'https://dev.java/learn/', provider: 'Java' },
    ],
    OOP: [
        { type: 'article', title: 'Oracle Java Tutorials: Object-Oriented Programming', description: 'Core object-oriented programming concepts including classes, objects, inheritance, and interfaces.', url: 'https://docs.oracle.com/javase/tutorial/java/concepts/', provider: 'Oracle' },
    ],
    'Spring Boot': [
        { type: 'article', title: 'Spring Boot Reference', description: 'Official Spring Boot documentation and getting-started material.', url: 'https://spring.io/projects/spring-boot', provider: 'Spring' },
    ],
    'REST API': [
        { type: 'article', title: 'MDN: HTTP Overview', description: 'Understand the HTTP methods and concepts behind REST-style APIs.', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview', provider: 'MDN' },
    ],
    'Node.js': [
        { type: 'article', title: 'Node.js Learn', description: 'Official Node.js learning resources for server-side JavaScript.', url: 'https://nodejs.org/en/learn', provider: 'Node.js' },
    ],
    Docker: [
        { type: 'article', title: 'Docker Get Started', description: 'Official hands-on introduction to containers and Docker workflows.', url: 'https://docs.docker.com/get-started/', provider: 'Docker' },
    ],
    AWS: [
        { type: 'article', title: 'AWS Skill Builder', description: 'AWS training and learning resources from Amazon Web Services.', url: 'https://skillbuilder.aws/', provider: 'AWS' },
    ],
    Excel: [
        { type: 'article', title: 'Microsoft Excel Help & Learning', description: 'Official Excel tutorials, formulas, functions, and data-analysis guidance.', url: 'https://support.microsoft.com/en-us/excel', provider: 'Microsoft' },
    ],
    Statistics: [
        { type: 'article', title: 'Khan Academy: Statistics & Probability', description: 'Lessons and practice covering statistics and probability fundamentals.', url: 'https://www.khanacademy.org/math/statistics-probability', provider: 'Khan Academy' },
    ],
    'Power BI': [
        { type: 'article', title: 'Microsoft Learn: Power BI', description: 'Structured Power BI learning paths, modules, and exercises.', url: 'https://learn.microsoft.com/en-us/training/powerplatform/power-bi', provider: 'Microsoft Learn' },
    ],
    'Network Security': [
        { type: 'article', title: 'Cisco Networking Academy', description: 'Networking and cybersecurity learning resources from Cisco.', url: 'https://www.netacad.com/courses/networking', provider: 'Cisco Networking Academy' },
    ],
    'Penetration Testing': [
        { type: 'article', title: 'OWASP Web Security Testing Guide', description: 'A practical guide to testing web applications for security weaknesses.', url: 'https://owasp.org/www-project-web-security-testing-guide/', provider: 'OWASP' },
    ],
    Photoshop: [
        { type: 'article', title: 'Adobe Photoshop Learn & Support', description: 'Official Photoshop tutorials, tools, and learning material.', url: 'https://helpx.adobe.com/photoshop/tutorials.html', provider: 'Adobe' },
    ],
    Figma: [
        { type: 'article', title: 'Figma Learn', description: 'Official lessons and resources for interface design and prototyping.', url: 'https://help.figma.com/hc/en-us/categories/360002051613-Learn-design', provider: 'Figma' },
    ],

    // Marketing Specialist resources
    'Digital Marketing': [
        { type: 'article', title: 'Google Skillshop', description: 'Training for Google marketing and advertising tools.', url: 'https://skillshop.withgoogle.com/', provider: 'Google' },
    ],
    'Market Research': [
        { type: 'article', title: 'Google Trends', description: 'Explore search interest and compare topics to support market research.', url: 'https://trends.google.com/', provider: 'Google' },
    ],
    'Content Marketing': [
        { type: 'article', title: 'HubSpot Content Marketing', description: 'Guides and lessons covering content strategy, creation, and measurement.', url: 'https://academy.hubspot.com/courses/content-marketing', provider: 'HubSpot' },
    ],
    'Social Media Marketing': [
        { type: 'article', title: 'Meta Blueprint', description: 'Training and learning resources for marketing on Meta platforms.', url: 'https://www.facebook.com/business/learn', provider: 'Meta' },
    ],
    SEO: [
        { type: 'article', title: 'Google Search Central SEO Starter Guide', description: 'Google guidance for creating search-friendly and useful content.', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', provider: 'Google Search Central' },
    ],
    'Email Marketing': [
        { type: 'article', title: 'HubSpot Email Marketing', description: 'Lessons and practical guidance for planning and running email campaigns.', url: 'https://academy.hubspot.com/courses/email-marketing', provider: 'HubSpot' },
    ],
    'Data Analytics': [
        { type: 'article', title: 'Google Analytics Academy', description: 'Learning resources for understanding website and campaign measurement.', url: 'https://analytics.google.com/analytics/academy/', provider: 'Google Analytics' },
    ],
};

function getLearningResources(skill) {
    const normalized = String(skill || '').trim();
    const resources = (RESOURCE_MAP[normalized] || []).map((resource) => ({ ...resource }));

    resources.push(DEFAULT_RESOURCES.youtube(normalized));

    return resources.slice(0, 3);
}

module.exports = { getLearningResources };
