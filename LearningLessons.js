// Beginner lesson catalog for JobSite Learning.
// Lessons are intentionally short and stored locally so the learning area
// does not require a large lesson database or external API.
'use strict';

const LESSONS = {
  HTML: [
    ['What HTML does', 'HTML gives a web page its structure. It uses elements such as headings, paragraphs, links, images, lists, and forms to describe what each part of a page means.'],
    ['Elements and attributes', 'An element normally has an opening tag, content, and a closing tag. Attributes add information, such as a link destination or alternative text for an image.'],
    ['Basic page structure', 'A basic page has a document declaration, an html element, a head for metadata, and a body for visible content. Good structure also helps accessibility.']
  ],
  CSS: [
    ['What CSS does', 'CSS controls how HTML content looks. You can change typography, spacing, borders, backgrounds, sizing, and many other visual properties.'],
    ['Selectors and properties', 'A selector chooses which elements to style, while declarations set properties and values. Classes are commonly used when the same style should apply to several elements.'],
    ['Layout basics', 'Flexbox is useful for arranging items along one main axis, while Grid is useful for rows and columns. Both are common foundations for responsive layouts.']
  ],
  JavaScript: [
    ['What JavaScript does', 'JavaScript adds behavior and logic to web pages. It can respond to user actions, change page content, validate forms, and communicate with a server.'],
    ['Variables and values', 'Variables hold values that your program can use. Common beginner values include strings, numbers, booleans, arrays, objects, null, and undefined.'],
    ['Conditions and functions', 'Conditions let a program choose what to do, while functions group reusable logic. Together they form basic building blocks for interactive applications.']
  ],
  Git: [
    ['Why Git is useful', 'Git records changes to files so developers can review history, restore earlier versions, and work safely on a project.'],
    ['The basic workflow', 'A simple workflow is edit files, check changes, stage intended changes, create a commit, and share commits with a remote repository when needed.'],
    ['Branches', 'A branch is an independent line of development. Branches let you work on a feature or fix without changing the main line until the work is ready.']
  ],
  SQL: [
    ['Tables and rows', 'A relational database stores related information in tables. Rows represent records and columns describe fields in those records.'],
    ['Reading data', 'SELECT retrieves data. WHERE filters rows, ORDER BY sorts results, and LIMIT can restrict how many rows are returned.'],
    ['Changing data', 'INSERT adds records, UPDATE changes existing records, and DELETE removes records. Use conditions carefully when modifying data.']
  ],
  Python: [
    ['Python basics', 'Python uses readable syntax and indentation to organize code. Variables can refer to strings, numbers, lists, dictionaries, and booleans.'],
    ['Control flow', 'if statements make decisions, while loops repeat while a condition remains true, and for loops commonly process items in a sequence.'],
    ['Functions', 'Functions package reusable logic. Parameters provide input and return values allow a function to send a result back to its caller.']
  ],
  Java: [
    ['Java program structure', 'Java programs are organized into classes. A basic console program commonly starts execution in a main method.'],
    ['Variables and types', 'Java is statically typed, so variables have declared types such as int, double, boolean, and String.'],
    ['Objects and classes', 'A class describes data and behavior, while an object is an instance of that class. This is a foundation of Java object-oriented programming.']
  ],
  React: [
    ['Components', 'React interfaces are built from components. A component can represent a reusable part of a page and can receive information through props.'],
    ['JSX', 'JSX lets you describe UI markup inside JavaScript. It looks similar to HTML, but it follows JavaScript and React rules.'],
    ['State and interaction', 'State represents data that can change while a component is running. When state changes, React can update the interface to reflect the new value.']
  ],
  'Node.js': [
    ['What Node.js is', 'Node.js provides a JavaScript runtime that can execute JavaScript outside the browser. It is commonly used for servers, APIs, and command-line tools.'],
    ['Modules and packages', 'Node.js applications can split code into modules. npm is commonly used to install and manage packages that provide reusable functionality.'],
    ['HTTP servers', 'A server listens for requests and sends responses. Frameworks such as Express make common HTTP routing and middleware patterns easier to implement.']
  ],
  'Network Security': [
    ['What network security means', 'Network security focuses on protecting networks, devices, and data from unauthorized access, misuse, and disruption.'],
    ['Firewalls', 'A firewall applies traffic rules to help control which network connections are allowed or blocked. It is one layer of a broader security strategy.'],
    ['Authentication and encryption', 'Authentication helps verify who or what is requesting access. Encryption helps protect information so unauthorized parties cannot easily read it.']
  ],
  'Penetration Testing': [
    ['What penetration testing is', 'Penetration testing is an authorized security assessment in which testers look for weaknesses within an agreed scope.'],
    ['Scope and authorization', 'Testing should have explicit permission and a defined scope covering systems, time windows, methods, and boundaries.'],
    ['Finding and reporting issues', 'A basic assessment involves discovering possible weaknesses, validating them safely, documenting evidence, and reporting risk and remediation.']
  ],
  AWS: [
    ['What cloud computing means', 'Cloud computing provides computing resources such as servers, storage, and databases through services that can be provisioned when needed.'],
    ['AWS services', 'AWS provides many cloud services. Beginners should first understand what a service is designed to provide instead of trying to memorize every product.'],
    ['Shared responsibility', 'Cloud security is shared between the provider and the customer. Customers remain responsible for security choices they control.']
  ],

  // Marketing Specialist learning path
  'Digital Marketing': [
    ['What digital marketing is', 'Digital marketing promotes products, services, or organizations through digital channels such as search engines, social media, websites, email, and online advertising.'],
    ['Understanding the audience', 'Marketing starts with knowing who you are trying to reach. Define the audience, their needs, the problem being solved, and the action you want them to take.'],
    ['Campaign basics', 'A basic campaign connects a goal, audience, message, channel, content, and measurement. The goal should be specific enough that results can be evaluated.']
  ],
  'Market Research': [
    ['What market research does', 'Market research gathers information about customers, competitors, trends, and demand so marketing decisions are based on evidence.'],
    ['Primary and secondary research', 'Primary research collects new information through methods such as surveys or interviews. Secondary research uses existing reports, articles, datasets, and other published information.'],
    ['Turning research into insight', 'Useful research organizes findings into patterns, customer needs, opportunities, and risks that can guide a campaign or business decision.']
  ],
  'Content Marketing': [
    ['What content marketing is', 'Content marketing uses useful and relevant content to attract, inform, and retain an audience instead of relying only on direct promotion.'],
    ['Choosing content for a goal', 'Blog posts, videos, guides, social posts, and other formats can serve different goals. Match the format and message to the audience and stage of the customer journey.'],
    ['Measuring content', 'Content performance can be reviewed using measures such as reach, engagement, traffic, conversions, and other metrics connected to the campaign goal.']
  ],
  'Social Media Marketing': [
    ['What social media marketing is', 'Social media marketing uses platforms such as Facebook, Instagram, TikTok, LinkedIn, and others to reach audiences, build relationships, and support campaign goals.'],
    ['Planning a social campaign', 'A social campaign should define the audience, platform, message, content format, posting schedule, and desired action before publishing.'],
    ['Engagement and measurement', 'Comments, shares, saves, clicks, reach, and conversions can help evaluate performance. The useful metric depends on the campaign objective.']
  ],
  SEO: [
    ['What SEO means', 'Search engine optimization improves the ability of useful web content to be discovered through search engines by making the content clear, relevant, accessible, and technically sound.'],
    ['Keywords and search intent', 'Keywords are phrases people use when searching. Good SEO considers the intent behind a search and creates content that directly addresses that intent.'],
    ['On-page SEO basics', 'Useful titles, headings, readable content, descriptive links, relevant keywords, and good page structure help both users and search engines understand a page.']
  ],
  'Email Marketing': [
    ['What email marketing is', 'Email marketing uses permission-based email communication to inform, nurture, and engage an audience or support a business campaign.'],
    ['Lists and segmentation', 'A useful email program keeps audience data organized and can group subscribers by relevant characteristics or behavior so messages are more useful.'],
    ['Campaign measurement', 'Open rates, clicks, conversions, unsubscribes, and other measures can help evaluate an email campaign. Always connect the metric to the campaign goal.']
  ],
  'Data Analytics': [
    ['What marketing analytics does', 'Marketing analytics turns campaign and customer data into information that can support decisions about audiences, channels, content, and performance.'],
    ['Common marketing metrics', 'Metrics can include reach, impressions, clicks, engagement, conversion rate, cost per acquisition, and return on advertising spend.'],
    ['Using data for decisions', 'The goal is not just to collect numbers. Compare results with the campaign objective, identify patterns, and use the findings to improve the next action.']
  ]
};

const QUIZZES = {
  HTML: [
    ['What is HTML mainly used for?', ['Styling a page', 'Structuring page content', 'Storing database records', 'Running a server'], 1, 'HTML describes the structure and meaning of web content.'],
    ['Which element is commonly used for the main page heading?', ['<h1>', '<p>', '<img>', '<br>'], 0, '<h1> is the top-level heading element.'],
    ['What do attributes provide?', ['Extra information about an element', 'Database tables', 'CSS files only', 'Server hardware'], 0, 'Attributes add information or configuration to an HTML element.']
  ],
  CSS: [
    ['What is CSS mainly used for?', ['Page styling and layout', 'Database storage', 'Server routing', 'Version control'], 0, 'CSS controls presentation such as typography, spacing, and layout.'],
    ['What does a selector do?', ['Chooses elements to style', 'Creates a database', 'Uploads a file', 'Starts a server'], 0, 'A selector identifies which elements a CSS rule applies to.'],
    ['Which layout system is designed around rows and columns?', ['Grid', 'FTP', 'SMTP', 'JSON'], 0, 'CSS Grid is designed for two-dimensional row and column layouts.']
  ],
  JavaScript: [
    ['What does JavaScript commonly add to a web page?', ['Interactivity and logic', 'Only colors', 'Only database tables', 'Physical hardware'], 0, 'JavaScript can respond to events, change content, and run application logic.'],
    ['Which value is a boolean?', ['"hello"', '42', 'true', '[1,2]'], 2, 'true and false are boolean values.'],
    ['What is a function?', ['A reusable block of logic', 'A CSS selector', 'A database row', 'An image format'], 0, 'Functions group logic so it can be called and reused.']
  ],
  Git: [
    ['What does Git primarily track?', ['Changes to files', 'Monitor brightness', 'Network cables', 'CPU temperature'], 0, 'Git is a version control system that records changes to files.'],
    ['What does a commit represent?', ['A saved set of changes in history', 'A new monitor', 'A database server', 'A CSS property'], 0, 'A commit records a set of changes in the repository history.'],
    ['Why use a branch?', ['To work on a separate line of development', 'To increase RAM', 'To style HTML', 'To encrypt every file'], 0, 'Branches isolate development work from another line such as main.']
  ],
  SQL: [
    ['Which SQL command reads data?', ['SELECT', 'PAINT', 'PUSH', 'STYLE'], 0, 'SELECT retrieves rows from a database.'],
    ['What does WHERE do?', ['Filters rows', 'Creates a color', 'Starts a server', 'Renames a monitor'], 0, 'WHERE limits results to rows that satisfy a condition.'],
    ['Which command adds a new row?', ['INSERT', 'DELETE', 'ORDER', 'BRANCH'], 0, 'INSERT adds records to a table.']
  ],
  Python: [
    ['What does indentation help define in Python?', ['Code blocks', 'Image resolution', 'Database indexes only', 'Network speed'], 0, 'Python uses indentation to define blocks of code.'],
    ['Which keyword makes a decision?', ['if', 'table', 'select', 'className'], 0, 'if runs a block when its condition is true.'],
    ['What is a function used for?', ['Reusable logic', 'Changing monitor hardware', 'Creating a CSS color', 'Formatting a PDF only'], 0, 'Functions package reusable operations.']
  ],
  Java: [
    ['What organizes Java data and behavior?', ['Classes', 'CSS selectors', 'SQL rows', 'HTML attributes'], 0, 'A Java class defines data and behavior for objects.'],
    ['Which is a Java primitive type?', ['int', 'StringBuilder', 'ArrayList', 'Scanner'], 0, 'int is a primitive numeric type in Java.'],
    ['What is an object?', ['An instance of a class', 'A CSS rule', 'A Git branch', 'A SQL keyword'], 0, 'An object is an instance created from a class.']
  ],
  React: [
    ['What are React interfaces built from?', ['Components', 'SQL tables', 'Git commits', 'Network packets'], 0, 'React applications are composed from reusable components.'],
    ['What is JSX?', ['A syntax for describing UI in JavaScript', 'A database engine', 'A CSS server', 'A Git command'], 0, 'JSX lets developers write UI-like markup within JavaScript.'],
    ['What can state represent?', ['Data that can change over time', 'Only CSS colors', 'A Git repository', 'A database server'], 0, 'State stores changing data that can affect rendered UI.']
  ],
  'Node.js': [
    ['What does Node.js provide?', ['A JavaScript runtime outside the browser', 'A CSS editor', 'A database table', 'A Git hosting site'], 0, 'Node.js lets JavaScript run outside the browser.'],
    ['What is npm commonly used for?', ['Managing packages', 'Styling HTML', 'Drawing icons', 'Changing CPU speed'], 0, 'npm is commonly used to install and manage JavaScript packages.'],
    ['What does an HTTP server do?', ['Receives requests and sends responses', 'Only styles pages', 'Only stores passwords', 'Creates Git branches'], 0, 'HTTP servers handle requests and return responses.']
  ],
  'Network Security': [
    ['What is a firewall used for?', ['Controlling network traffic by rules', 'Writing HTML', 'Editing photos', 'Managing Git commits'], 0, 'Firewalls can allow or block network traffic according to rules.'],
    ['What does authentication help verify?', ['Identity', 'Screen size', 'CSS syntax', 'File extension'], 0, 'Authentication verifies who or what is requesting access.'],
    ['What does encryption help protect?', ['Information confidentiality', 'Monitor brightness', 'HTML indentation', 'Git branch names only'], 0, 'Encryption helps prevent unauthorized parties from reading protected information.']
  ],
  'Penetration Testing': [
    ['What is required before authorized penetration testing?', ['Permission and defined scope', 'A random target', 'A public password list', 'No documentation'], 0, 'Security testing should be explicitly authorized and scoped.'],
    ['What is a main goal of penetration testing?', ['Find and validate security weaknesses safely', 'Damage systems', 'Hide vulnerabilities', 'Remove all logs'], 0, 'Authorized testing identifies weaknesses so they can be fixed.'],
    ['What should a finding include?', ['Evidence and remediation guidance', 'Only a screenshot with no context', 'A random password', 'A new Git branch'], 0, 'Useful findings document evidence, impact, and recommended remediation.']
  ],
  AWS: [
    ['What does cloud computing provide?', ['On-demand computing resources', 'Only local files', 'Only HTML styling', 'Git commits'], 0, 'Cloud services provide computing resources that can be provisioned when needed.'],
    ['What is an AWS service?', ['A cloud capability offered by AWS', 'A CSS selector', 'A Git commit', 'A Java variable'], 0, 'AWS provides many distinct cloud services for different workloads.'],
    ['What does shared responsibility mean?', ['Provider and customer each have security responsibilities', 'Only the customer has responsibilities', 'Only the provider has responsibilities', 'Nobody is responsible'], 0, 'Cloud security responsibilities are divided between the provider and customer.']
  ],
  'Digital Marketing': [
    ['What is a core part of digital marketing?', ['Connecting an audience, message, channel, and goal', 'Only writing computer code', 'Only repairing hardware', 'Only managing databases'], 0, 'Digital marketing connects a defined audience and message to digital channels and measurable goals.'],
    ['Why define an audience?', ['To make the message more relevant', 'To avoid measuring results', 'To replace campaign goals', 'To remove all content'], 0, 'Knowing the audience helps marketers create more relevant messages and campaigns.'],
    ['What should a campaign have?', ['A clear goal', 'No measurement', 'No target audience', 'Only a logo'], 0, 'A clear goal makes it possible to plan and evaluate a campaign.']
  ],
  'Market Research': [
    ['What is market research used for?', ['Understanding customers, competitors, trends, and demand', 'Only designing logos', 'Only writing code', 'Only sending emails'], 0, 'Market research provides information that supports marketing and business decisions.'],
    ['Which is primary research?', ['A survey you conduct with customers', 'A published industry report', 'A public article', 'An existing dataset'], 0, 'Primary research collects new information directly from a source.'],
    ['What should research lead to?', ['Useful insights for decisions', 'A random list of facts', 'No action', 'Only a graphic'], 0, 'Research becomes useful when findings are interpreted into insights that guide decisions.']
  ],
  'Content Marketing': [
    ['What is content marketing mainly about?', ['Creating useful content for a defined audience', 'Only buying hardware', 'Only writing software', 'Only changing database tables'], 0, 'Content marketing uses useful and relevant content to attract and retain an audience.'],
    ['What should determine a content format?', ['Audience and campaign goal', 'Random selection', 'Computer hardware', 'Git branch name'], 0, 'The audience and objective help determine which content format is appropriate.'],
    ['Which can be a content metric?', ['Conversions', 'CPU temperature', 'RAM speed', 'Screen resolution'], 0, 'Conversions can show whether content is contributing to a campaign goal.']
  ],
  'Social Media Marketing': [
    ['What should a social media campaign define first?', ['Audience, goal, platform, and message', 'Only a profile picture', 'Only a password', 'Only a font'], 0, 'A campaign needs a clear audience, objective, platform, and message before publishing.'],
    ['Which can measure social engagement?', ['Shares and comments', 'CPU usage', 'Database rows', 'File size'], 0, 'Shares and comments are common indicators of audience engagement.'],
    ['Why choose different platforms?', ['Audiences and content behavior differ by platform', 'All platforms are identical', 'Platforms do not have audiences', 'It removes the need for goals'], 0, 'Different platforms have different audiences, formats, and user behavior.']
  ],
  SEO: [
    ['What does SEO help improve?', ['Discovery of useful content through search engines', 'Computer hardware speed', 'Database storage size', 'Git history'], 0, 'SEO helps useful content become easier to discover through search engines.'],
    ['What is search intent?', ['The purpose behind a search query', 'A CSS property', 'A database command', 'A social media password'], 0, 'Search intent describes what the user is trying to accomplish with a search.'],
    ['Which is an on-page SEO practice?', ['Using clear titles and headings', 'Changing CPU voltage', 'Creating Git branches', 'Formatting a hard drive'], 0, 'Clear titles, headings, and relevant content help users and search engines understand a page.']
  ],
  'Email Marketing': [
    ['What is email marketing used for?', ['Permission-based communication with an audience', 'Only repairing computers', 'Only designing websites', 'Only managing servers'], 0, 'Email marketing uses email to inform, nurture, and engage an audience.'],
    ['Why use segmentation?', ['To make messages more relevant to groups of subscribers', 'To remove all subscribers', 'To avoid campaign goals', 'To stop measuring results'], 0, 'Segmentation can make messages more relevant to different audience groups.'],
    ['Which can measure an email campaign?', ['Click-through rate', 'CPU temperature', 'Screen size', 'Git commit count'], 0, 'Click-through rate can help measure audience interaction with an email campaign.']
  ],
  'Data Analytics': [
    ['What does marketing analytics do?', ['Turns campaign data into information for decisions', 'Only creates logos', 'Only repairs computers', 'Only writes emails'], 0, 'Marketing analytics uses data to understand performance and support decisions.'],
    ['Which is a marketing metric?', ['Conversion rate', 'CPU temperature', 'RAM voltage', 'Monitor refresh rate'], 0, 'Conversion rate measures the share of users who complete a desired action.'],
    ['What should marketers do with campaign data?', ['Compare results with goals and improve decisions', 'Collect numbers without using them', 'Delete all results', 'Ignore the campaign objective'], 0, 'Data is useful when it is connected to goals and used to improve future actions.']
  ]
};

function getLesson(skill) {
  const name = String(skill || '').trim();
  const lessons = LESSONS[name];
  if (!lessons) return null;
  return {
    skill: name,
    level: 'Beginner',
    description: 'Short, foundation-level lessons for learners who are new to this skill.',
    lessons: lessons.map((item, index) => ({ step: index + 1, title: item[0], content: item[1] })),
    quiz: (QUIZZES[name] || []).map((item, index) => ({ question: index + 1, prompt: item[0], options: item[1] }))
  };
}

function getAvailableLessons() {
  return Object.keys(LESSONS).map((skill) => ({
    skill,
    level: 'Beginner',
    description: 'Short foundation lesson'
  }));
}

function gradeQuiz(skill, answers) {
  const name = String(skill || '').trim();
  const quiz = QUIZZES[name];
  if (!quiz || !Array.isArray(answers) || answers.length !== quiz.length) return null;

  const normalized = answers.map((answer) => Number(answer));
  if (normalized.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) return null;

  const score = quiz.reduce((total, item, index) => total + (normalized[index] === item[2] ? 1 : 0), 0);
  const passed = score >= Math.ceil(quiz.length * 0.67);

  return {
    skill: name,
    score,
    total: quiz.length,
    passed,
    explanations: quiz.map((item, index) => ({
      question: index + 1,
      correct: normalized[index] === item[2],
      correctAnswer: item[1][item[2]],
      explanation: item[3]
    }))
  };
}

module.exports = { getLesson, getAvailableLessons, gradeQuiz };
