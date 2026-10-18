(function (root, factory) {
    const taxonomy = factory();
    if (typeof module === 'object' && module.exports) module.exports = taxonomy;
    if (root) root.JobsiteSkillTaxonomy = taxonomy;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const ALIASES = [
        { canonical: 'Accounting', category: 'Accounting', aliases: ['accountant', 'accountancy', 'accounting skills', 'financial accounts'] },
        { canonical: 'Bookkeeping', category: 'Accounting', aliases: ['book keeping', 'bookkeeper', 'book keepers', 'keeping books', 'recording business transactions'] },
        { canonical: 'Financial Reporting', category: 'Finance', aliases: ['financial statement preparation', 'preparing financial statements', 'financial statements', 'management reporting'] },
        { canonical: 'Financial Analysis', category: 'Finance', aliases: ['finance analysis', 'financial data analysis', 'investment analysis'] },
        { canonical: 'Budgeting', category: 'Finance', aliases: ['budget preparation', 'budget management', 'budget planning'] },
        { canonical: 'Tax Preparation', category: 'Accounting', aliases: ['tax filing', 'tax returns', 'tax accounting'] },
        { canonical: 'Accounts Payable', category: 'Accounting', aliases: ['payables', 'supplier invoices', 'vendor payments'] },
        { canonical: 'Accounts Receivable', category: 'Accounting', aliases: ['receivables', 'customer invoices', 'collections'] },
        { canonical: 'Payroll', category: 'Accounting', aliases: ['payroll processing', 'salary processing', 'employee salary computation'] },
        { canonical: 'Customer Service', category: 'Customer Service', aliases: ['customer support', 'client support', 'client service', 'customer care'] },
        { canonical: 'Sales', category: 'Sales', aliases: ['selling', 'sales skills', 'sales representative'] },
        { canonical: 'Digital Marketing', category: 'Marketing', aliases: ['online marketing', 'internet marketing'] },
        { canonical: 'Social Media Marketing', category: 'Marketing', aliases: ['social media management', 'social media handling'] },
        { canonical: 'Human Resources', category: 'Human Resources', aliases: ['hr', 'human resource management', 'people operations'] },
        { canonical: 'Recruitment', category: 'Human Resources', aliases: ['recruiting', 'talent sourcing', 'hiring'] },
        { canonical: 'Data Analysis', category: 'Data', aliases: ['data analytics', 'data analyst skills', 'analyzing data'] },
        { canonical: 'Microsoft Excel', category: 'Office', aliases: ['excel', 'spreadsheet skills', 'spreadsheets'] },
        { canonical: 'Graphic Design', category: 'Design', aliases: ['graphics design', 'visual design'] },
        { canonical: 'Project Management', category: 'Professional', aliases: ['project coordination', 'managing projects'] },
        { canonical: 'Inventory Management', category: 'Business', aliases: ['stock management', 'inventory control'] },
        { canonical: 'Supply Chain Management', category: 'Business', aliases: ['supply chain', 'logistics management'] },
        { canonical: 'Business Administration', category: 'Business', aliases: ['business admin', 'business operations'] }
    ];

    const CATEGORY_KEYWORDS = [
        { category: 'Accounting', pattern: /account|bookkeep|book.?keep|audit|tax prepar|accounts payable|accounts receivable|payroll|quickbooks|xero|invoice|ledger/ },
        { category: 'Finance', pattern: /finance|financial|budget|forecast|cash flow|investment|treasury/ },
        { category: 'Business', pattern: /business|operations|procurement|supply chain|inventory|logistics|administration/ },
        { category: 'Marketing', pattern: /market|seo|campaign|brand|advertis|social media|content marketing/ },
        { category: 'Sales', pattern: /sales|selling|lead generation|prospecting/ },
        { category: 'Human Resources', pattern: /human resources|\bhr\b|recruit|talent acquisition|onboarding|employee relations/ },
        { category: 'Customer Service', pattern: /customer service|customer support|client support|call center|help desk/ },
        { category: 'Data', pattern: /data analys|data analytic|business intelligence|power bi|tableau|statistics/ },
        { category: 'Programming Language', pattern: /python|javascript|java programming|c\+\+|programming|coding/ },
        { category: 'Web', pattern: /web development|html|css|react|angular|vue|frontend|back.?end/ },
        { category: 'IT Support', pattern: /it support|troubleshoot|network support|hardware support|technical support/ },
        { category: 'Design', pattern: /graphic design|visual design|ui.?ux|figma|typography|illustration/ },
        { category: 'Office', pattern: /microsoft excel|spreadsheet|microsoft office|word processing|google workspace/ },
        { category: 'Professional', pattern: /communication|leadership|teamwork|time management|problem solving|critical thinking/ }
    ];

    function normalize(value) {
        return String(value || '').toLowerCase().normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9+#.]+/g, ' ').trim().replace(/\s+/g, ' ');
    }

    function findAlias(value) {
        const query = normalize(value);
        if (!query) return null;
        return ALIASES.find((item) =>
            normalize(item.canonical) === query ||
            item.aliases.some((alias) => normalize(alias) === query)
        ) || null;
    }

    function findCanonicalSkill(value, skills) {
        const alias = findAlias(value);
        if (!alias || !Array.isArray(skills)) return null;
        return skills.find((skill) => normalize(skill.name) === normalize(alias.canonical)) || null;
    }

    function inferSkillCategory(value) {
        const query = normalize(value);
        const alias = findAlias(query);
        if (alias) return alias.category;
        for (const item of CATEGORY_KEYWORDS) {
            if (item.pattern.test(query)) return item.category;
        }
        return 'Other';
    }

    function getSkillSuggestions(value, skills) {
        const query = normalize(value);
        if (!query || !Array.isArray(skills)) return [];
        const queryTokens = query.split(' ').filter((token) => token.length > 1);
        const alias = findAlias(query);
        const broadCategories = {
            business: ['Accounting', 'Finance', 'Business', 'Business Software', 'Management', 'Sales', 'Marketing'],
            finance: ['Accounting', 'Finance'],
            technology: ['Programming Language', 'Web', 'Database', 'Framework', 'IT Support', 'Cybersecurity', 'Data'],
            tech: ['Programming Language', 'Web', 'Database', 'Framework', 'IT Support', 'Cybersecurity', 'Data'],
            creative: ['Design', 'Design Tool', 'Creative', 'Media'],
            office: ['Office', 'Collaboration', 'Business Software']
        };
        const categories = broadCategories[query] || [];
        return skills.map((skill) => {
            const name = normalize(skill.name);
            const category = normalize(skill.category);
            let score = 0;
            if (name === query) score += 100;
            if (alias && name === normalize(alias.canonical)) score += 95;
            if (name.startsWith(query)) score += 35;
            if (name.includes(query)) score += 25;
            if (category.includes(query)) score += 14;
            if (categories.includes(skill.category)) score += 18;
            for (const token of queryTokens) {
                if (name.includes(token)) score += 7;
                if (category.includes(token)) score += 4;
            }
            if (alias && alias.category === skill.category) score += 5;
            return { skill, score };
        }).filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score || String(a.skill.name).localeCompare(String(b.skill.name)))
          .map((item) => item.skill);
    }

    return { normalize, findAlias, findCanonicalSkill, inferSkillCategory, getSkillSuggestions };
});
