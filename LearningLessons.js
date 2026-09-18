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
    lessons: lessons.map((item, index) => ({ step: index + 1, title: item[0], content: item[1] }))
  };
}

function getAvailableLessons() {
  return Object.keys(LESSONS).map((skill) => ({
    skill,
    level: 'Beginner',
    description: 'Short foundation lesson'
  }));
}

module.exports = { getLesson, getAvailableLessons };
