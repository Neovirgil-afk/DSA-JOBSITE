'use strict';

// Local presentation seed. Safe to re-run; refuses production by default.
if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_ALLOW_PRODUCTION !== '1') {
    console.error('[demo-seed] Refusing to seed demo data in production.');
    process.exit(1);
}
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const PASSWORD = 'JobPathDemo2026!';
const HASH = bcrypt.hashSync(PASSWORD, 10);

const employers = [
 {name:'Mikaela Santos',email:'demo.employer1@jobpath.test',company:'Northstar Digital Works',description:'Fictional software studio building accessible digital products for Philippine businesses.',industry:'Software Development',size:'11-50 employees',location:'Makati, Philippines',founded:'2018',phone:'+63 2 8555 0101',website:'https://northstar.example',jobs:[
  {title:'Frontend Developer',category:'IT & Software',location:'Hybrid - Makati, Philippines',salary:'₱30,000 - ₱45,000',type:'Full-time',schedule:'Monday-Friday, 9:00 AM-6:00 PM',description:'Build responsive, accessible web interfaces for customer-facing products. Work with design and backend teammates to turn product requirements into polished experiences.',responsibilities:'Build reusable UI components; implement responsive layouts; connect screens to REST APIs; test modern browsers; review code and document changes.',qualifications:'Portfolio or school project using HTML, CSS, and JavaScript. React is preferred. Entry-level applicants are welcome.',skills:['HTML','CSS','JavaScript','React','Git'],benefits:'HMO after regularization; paid training; equipment allowance; mentorship; paid leave.',requirements:'Resume or portfolio link and a short introduction.',how:'Apply through JobPath and include a portfolio link. Shortlisted applicants will receive a platform message.',contact:'talent@northstar.example'},
  {title:'Junior Backend Developer',category:'IT & Software',location:'Makati, Philippines',salary:'₱32,000 - ₱48,000',type:'Full-time',schedule:'Monday-Friday, flexible start between 8:00-10:00 AM',description:'Help maintain APIs and data services for internal and customer applications while learning production engineering practices.',responsibilities:'Implement API endpoints; write database queries; validate data; add tests; investigate bugs; participate in code reviews.',qualifications:'Basic JavaScript or Java; understanding of HTTP and relational databases; willingness to learn secure coding and testing.',skills:['Node.js','Express.js','SQL','REST API','Git'],benefits:'Learning budget; mentorship; HMO after regularization; hybrid schedule; paid leave.',requirements:'Resume and project or GitHub link if available.',how:'Apply on JobPath and describe a bug or backend feature you worked on.',contact:'talent@northstar.example'},
  {title:'QA and Software Testing Associate',category:'IT & Software',location:'Hybrid - Makati, Philippines',salary:'₱25,000 - ₱36,000',type:'Full-time',schedule:'Monday-Friday, 9:00 AM-6:00 PM',description:'Help release dependable software by testing new features, documenting defects, and verifying fixes before deployment.',responsibilities:'Create test cases; run functional and regression tests; write bug reports; verify fixes; maintain test evidence; coordinate with developers.',qualifications:'Attention to detail; basic web application knowledge; issue-tracker familiarity is a plus. Fresh graduates welcome.',skills:['Software Testing','Debugging','Test Automation','Git','Communication'],benefits:'Training plan; HMO after regularization; paid leave; supportive team.',requirements:'Resume and a short example of how you would report a website bug.',how:'Apply through JobPath. The team may send a short practical exercise.',contact:'talent@northstar.example'}
 ]},
 {name:'Paolo Reyes',email:'demo.employer2@jobpath.test',company:'Harborlight Software Co.',description:'Fictional engineering company creating dependable business systems, APIs, and cloud-connected applications.',industry:'Enterprise Software',size:'51-100 employees',location:'Cebu City, Philippines',founded:'2016',phone:'+63 32 855 0202',website:'https://harborlight.example',jobs:[
  {title:'Java Developer',category:'IT & Software',location:'Cebu City, Philippines',salary:'₱34,000 - ₱52,000',type:'Full-time',schedule:'Monday-Friday, 8:30 AM-5:30 PM',description:'Contribute to business applications built with Java and relational databases, supported by an experienced engineering team.',responsibilities:'Implement backend features; write object-oriented code; maintain SQL queries; test services; review pull requests; document decisions.',qualifications:'Knowledge of Java and OOP; basic SQL; understanding of Git. Spring Boot is an advantage.',skills:['Java','OOP','SQL','Spring Boot','Git'],benefits:'HMO; training allowance; hybrid work by team arrangement; paid leave.',requirements:'Resume and a school or personal coding project if available.',how:'Apply on JobPath and mention Java experience or coursework.',contact:'careers@harborlight.example'},
  {title:'API Integration Associate',category:'IT & Software',location:'Hybrid - Cebu City, Philippines',salary:'₱30,000 - ₱44,000',type:'Full-time',schedule:'Monday-Friday, flexible start',description:'Connect internal systems and third-party services through documented APIs and reliable data exchange.',responsibilities:'Integrate REST endpoints; inspect request and response payloads; handle errors; write integration notes; test endpoints; collaborate with product teams.',qualifications:'Basic HTTP, JSON, and programming knowledge; structured troubleshooting; API testing experience is helpful.',skills:['REST API','JavaScript','JSON','SQL','Debugging'],benefits:'Mentoring; HMO after regularization; training resources; paid leave.',requirements:'Resume and a short description of an API you have studied or built.',how:'Submit your application via JobPath with links to relevant projects.',contact:'careers@harborlight.example'},
  {title:'Technical Support Engineer',category:'IT & Software',location:'Cebu City, Philippines',salary:'₱24,000 - ₱35,000',type:'Full-time',schedule:'Rotating weekday shifts shared in advance',description:'Help business users resolve application issues and communicate clear technical findings to engineering teams.',responsibilities:'Triage tickets; reproduce issues; document troubleshooting; escalate defects; maintain help articles; follow up with users.',qualifications:'Clear written communication; basic networking and web concepts; patience and structured problem solving.',skills:['Troubleshooting','Computer Networking','Windows','Communication','Customer Service'],benefits:'Training; HMO after regularization; applicable shift allowance; paid leave.',requirements:'Resume and an example of how you would troubleshoot a login issue.',how:'Apply through JobPath and describe customer support or technical experience.',contact:'careers@harborlight.example'}
 ]},
 {name:'Alyssa Cruz',email:'demo.employer3@jobpath.test',company:'Mosaic Byte Studio',description:'Fictional creative technology studio combining user research, interface design, and practical web development.',industry:'Digital Design',size:'11-50 employees',location:'Quezon City, Philippines',founded:'2020',phone:'+63 2 8555 0303',website:'https://mosaicbyte.example',jobs:[
  {title:'UI/UX Design Associate',category:'Design',location:'Remote - Philippines',salary:'₱28,000 - ₱42,000',type:'Full-time',schedule:'Monday-Friday, core hours 10:00 AM-4:00 PM',description:'Design intuitive digital experiences by turning user needs into clear flows, wireframes, and polished interface concepts.',responsibilities:'Create wireframes and prototypes; organize design files; document user flows; join feedback sessions; coordinate design handoffs.',qualifications:'Portfolio or coursework in interface design; understanding of usability and responsive design; ability to explain design decisions.',skills:['Figma','UI/UX Design','Wireframing','Prototyping','Communication'],benefits:'Remote setup allowance; design learning budget; flexible work; paid leave.',requirements:'Resume and portfolio link. Student portfolios welcome.',how:'Apply through JobPath and include your portfolio URL in the application note.',contact:'people@mosaicbyte.example'},
  {title:'Web Designer',category:'Design',location:'Quezon City, Philippines',salary:'₱26,000 - ₱38,000',type:'Full-time',schedule:'Monday-Friday, 9:00 AM-6:00 PM',description:'Create consistent website layouts and visual assets for small-business and startup clients.',responsibilities:'Design page layouts; prepare responsive mockups; maintain visual consistency; export assets; collaborate with developers; revise designs from feedback.',qualifications:'Basic typography, spacing, color, and layout skills; familiarity with Figma; HTML/CSS awareness is helpful.',skills:['Web Design','Figma','Responsive Web Design','HTML','CSS'],benefits:'Mentorship; equipment allowance; training time; HMO after regularization.',requirements:'Resume and at least two examples of design work or class projects.',how:'Submit your JobPath application with a portfolio or sample designs.',contact:'people@mosaicbyte.example'},
  {title:'Junior Content and SEO Writer',category:'Media & Communication',location:'Remote - Philippines',salary:'₱24,000 - ₱36,000',type:'Full-time',schedule:'Monday-Friday, flexible schedule with weekly planning',description:'Write useful website copy and articles that make technical products easier to understand and discover.',responsibilities:'Research topics; draft and edit content; organize calendars; apply on-page SEO; check facts and links; collaborate with designers.',qualifications:'Clear writing; careful research; willingness to revise; SEO knowledge is a plus.',skills:['Content Writing','Copywriting','Research','SEO','Editing'],benefits:'Writing workshops; remote work; paid leave; professional development support.',requirements:'Resume and one or two writing samples, including school work if relevant.',how:'Apply via JobPath and provide writing samples or links.',contact:'people@mosaicbyte.example'}
 ]},
 {name:'Gabriel Lim',email:'demo.employer4@jobpath.test',company:'Summit Data Labs',description:'Fictional analytics team helping organizations understand performance through clean data, dashboards, and reporting.',industry:'Data Analytics',size:'11-50 employees',location:'Taguig, Philippines',founded:'2019',phone:'+63 2 8555 0404',website:'https://summitdata.example',jobs:[
  {title:'Junior Data Analyst',category:'Data',location:'Hybrid - Taguig, Philippines',salary:'₱30,000 - ₱45,000',type:'Full-time',schedule:'Monday-Friday, 9:00 AM-6:00 PM',description:'Prepare datasets, investigate trends, and build reports that help teams make evidence-based decisions.',responsibilities:'Clean spreadsheet and database data; write SQL; validate metrics; build charts; document assumptions; present findings.',qualifications:'Basic SQL and spreadsheet skills; analytical thinking; Power BI or Tableau is helpful. Fresh graduates may apply.',skills:['SQL','Excel','Data Analysis','Statistics','Power BI'],benefits:'Analytics training; HMO after regularization; hybrid setup; paid leave.',requirements:'Resume and a sample dashboard, coursework, or data project if available.',how:'Apply on JobPath and describe a data problem you worked on.',contact:'careers@summitdata.example'},
  {title:'Reporting and Dashboard Associate',category:'Data',location:'Taguig, Philippines',salary:'₱28,000 - ₱40,000',type:'Full-time',schedule:'Monday-Friday, 9:00 AM-6:00 PM',description:'Maintain recurring reports and dashboards, ensuring data is consistent, readable, and delivered on time.',responsibilities:'Refresh reports; reconcile figures; maintain dashboards; investigate discrepancies; document report definitions; support internal users.',qualifications:'Comfort with Excel or Sheets; attention to detail; basic charting and data literacy; SQL is a plus.',skills:['Excel','Data Visualization','Power BI','SQL','Attention to Detail'],benefits:'Training budget; mentorship; HMO after regularization; paid leave.',requirements:'Resume and optional sample report or class project.',how:'Apply through JobPath and mention spreadsheet and dashboard tools used.',contact:'careers@summitdata.example'},
  {title:'Python Data Intern',category:'Data',location:'Hybrid - Taguig, Philippines',salary:'₱18,000 - ₱25,000',type:'Internship',schedule:'20-30 hours weekly, arranged around school',description:'Support small data automation and analysis tasks while learning good practices from data analysts.',responsibilities:'Prepare datasets; write Python scripts; check data quality; create charts; document code; share weekly progress.',qualifications:'Student in IT, computer science, statistics, or related course; basic Python; willingness to learn.',skills:['Python','SQL','Data Analysis','Pandas','Git'],benefits:'Mentorship; completion certificate; flexible school-friendly hours; portfolio experience.',requirements:'Resume and preferred internship dates and availability.',how:'Apply on JobPath and state your weekly availability.',contact:'careers@summitdata.example'}
 ]},
 {name:'Bianca Flores',email:'demo.employer5@jobpath.test',company:'Cedarwave Technologies',description:'Fictional cloud and IT services provider focused on secure systems, practical automation, and dependable support.',industry:'Cloud and IT Services',size:'51-100 employees',location:'Pasig, Philippines',founded:'2017',phone:'+63 2 8555 0505',website:'https://cedarwave.example',jobs:[
  {title:'Junior DevOps Engineer',category:'IT & Software',location:'Hybrid - Pasig, Philippines',salary:'₱38,000 - ₱55,000',type:'Full-time',schedule:'Monday-Friday, 9:00 AM-6:00 PM; occasional planned maintenance',description:'Assist with deployment pipelines and cloud environments while learning safe, repeatable operations practices.',responsibilities:'Maintain CI/CD pipelines; assist with deployment checks; monitor services; update runbooks; troubleshoot builds; support automation.',qualifications:'Basic Linux and Git; interest in cloud infrastructure; Docker or CI/CD coursework is helpful.',skills:['Linux','Git','Docker','CI/CD','AWS'],benefits:'Certification support; HMO after regularization; hybrid work; paid leave.',requirements:'Resume and a deployment, scripting, or infrastructure project if available.',how:'Apply through JobPath. Entry-level applicants may list labs or personal projects.',contact:'talent@cedarwave.example'},
  {title:'IT Support Specialist',category:'IT & Software',location:'Pasig, Philippines',salary:'₱23,000 - ₱34,000',type:'Full-time',schedule:'Monday-Friday, 8:00 AM-5:00 PM; occasional rotating support',description:'Provide structured first-line technical support for employee devices, accounts, and common software issues.',responsibilities:'Respond to tickets; diagnose device problems; assist account setup; maintain asset records; escalate security concerns; write knowledge-base notes.',qualifications:'Basic Windows and networking knowledge; customer service mindset; clear documentation. Fresh graduates welcome.',skills:['Windows','Computer Networking','Troubleshooting','Cybersecurity','Customer Service'],benefits:'Training; HMO after regularization; equipment access; paid leave.',requirements:'Resume and how you would investigate a computer that cannot connect to Wi-Fi.',how:'Submit your JobPath application and include relevant training or certifications.',contact:'talent@cedarwave.example'},
  {title:'Information Security Analyst Trainee',category:'IT & Software',location:'Hybrid - Pasig, Philippines',salary:'₱30,000 - ₱44,000',type:'Full-time',schedule:'Monday-Friday, 9:00 AM-6:00 PM',description:'Support security monitoring and basic risk reviews under guidance from experienced security staff.',responsibilities:'Review alerts; document findings; assist access reviews; follow incident playbooks; maintain checklists; prepare awareness materials.',qualifications:'Foundational networking and operating-system knowledge; ethical data handling; careful documentation. Security labs are a plus.',skills:['Cybersecurity','Computer Networking','Linux','Risk Assessment','Documentation'],benefits:'Security training; certification support; HMO after regularization; mentorship.',requirements:'Resume and optional security coursework or lab portfolio. Never include real passwords or confidential data.',how:'Apply on JobPath and outline your security learning interests and completed labs.',contact:'talent@cedarwave.example'}
 ]}
];

const candidates = [
 {name:'Jordan Mendoza',email:'demo.employee1@jobpath.test',education:'BS Information Technology',degree:'Bachelor of Science',target:'Frontend Developer',location:'Bacoor, Cavite, Philippines',school:'South Metro Institute',field:'Information Technology',year:'2026',expTitle:'Student Web Developer',expCompany:'Academic Projects',duration:'2024-2026',exp:'Built responsive class websites using HTML, CSS, and JavaScript; collaborated with classmates using Git.',skills:['HTML','CSS','JavaScript','Git','Figma']},
 {name:'Samira Villanueva',email:'demo.employee2@jobpath.test',education:'BS Computer Science',degree:'Bachelor of Science',target:'Backend Developer',location:'Quezon City, Philippines',school:'Metro Tech University',field:'Computer Science',year:'2025',expTitle:'Programming Intern',expCompany:'Campus Systems Lab',duration:'2025',exp:'Tested API endpoints, wrote SQL queries, and documented bugs for a student information system.',skills:['Java','SQL','OOP','REST API','Git','Debugging']},
 {name:'Ethan Navarro',email:'demo.employee3@jobpath.test',education:'BS Information Systems',degree:'Bachelor of Science',target:'Data Analyst',location:'Taguig, Philippines',school:'East Bay College',field:'Information Systems',year:'2026',expTitle:'Student Data Analyst',expCompany:'Capstone Project Team',duration:'2025-2026',exp:'Cleaned survey data, prepared spreadsheet summaries, and presented charts for a capstone project.',skills:['Excel','SQL','Python','Statistics','Power BI']},
 {name:'Chloe Ramirez',email:'demo.employee4@jobpath.test',education:'BA Communication',degree:'Bachelor of Arts',target:'Content Writer',location:'Cebu City, Philippines',school:'Cebu Creative College',field:'Communication',year:'2025',expTitle:'Content Volunteer',expCompany:'Student Media Group',duration:'2023-2025',exp:'Researched and edited articles, maintained a content calendar, and checked drafts for clarity and accuracy.',skills:['Content Writing','Research','Copywriting','SEO','Communication']},
 {name:'Noah Bautista',email:'demo.employee5@jobpath.test',education:'BS Information Technology',degree:'Bachelor of Science',target:'IT Support Specialist',location:'Pasig, Philippines',school:'Central Luzon Digital College',field:'Information Technology',year:'2024',expTitle:'IT Lab Assistant',expCompany:'College Computer Laboratory',duration:'2023-2024',exp:'Helped with workstation setup, Windows troubleshooting, printer issues, and network connectivity checks.',skills:['Windows','Computer Networking','Troubleshooting','Customer Service','Cybersecurity']}
];

const insertSkill = db.prepare('INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)');
const findSkill = db.prepare('SELECT id FROM skills WHERE name = ? COLLATE NOCASE');
const findUser = db.prepare('SELECT id FROM users WHERE email = ?');
const addUser = db.prepare('INSERT INTO users (full_name,email,password_hash,education,degree,target_job,location,role) VALUES (?,?,?,?,?,?,?,?)');
const updateUser = db.prepare('UPDATE users SET full_name=?,password_hash=?,education=?,degree=?,target_job=?,location=?,role=? WHERE id=?');
const addProfile = db.prepare('INSERT INTO company_profiles (company_name,description,email,phone,website,industry,company_size,location,founded_year,benefits,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
const addJob = db.prepare("INSERT INTO jobs (title,description,company,location,category,salary,employment_type,responsibilities,qualifications,work_schedule,benefits,application_requirements,how_to_apply,contact_information,status,employer_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
const addJobSkill = db.prepare('INSERT OR IGNORE INTO job_skills (job_id,skill_id,required) VALUES (?,?,1)');
const addUserSkill = db.prepare("INSERT OR IGNORE INTO user_skills (user_id,skill_id,source) VALUES (?,?, 'manual')");
const addApplication = db.prepare("INSERT OR IGNORE INTO applications (job_id,user_id,status) VALUES (?,?,'new')");
const addHistory = db.prepare('INSERT INTO application_history (application_id,status) VALUES (?,?)');
const addMessage = db.prepare('INSERT INTO messages (application_id,sender_id,recipient_id,body) VALUES (?,?,?,?)');

const runSeed = db.transaction(() => {
 const employerIds=[], jobsByEmployer=[];
 for (const e of employers) {
  let u=findUser.get(e.email);
  if (!u) { const r=addUser.run(e.name,e.email,HASH,'','','',e.location,'employer'); u={id:Number(r.lastInsertRowid)}; }
  else updateUser.run(e.name,HASH,'','','',e.location,'employer',u.id);
  const p=db.prepare('SELECT id FROM company_profiles WHERE user_id=?').get(u.id);
  if (p) {
   db.prepare('UPDATE company_profiles SET description=?,email=?,phone=?,website=?,industry=?,company_size=?,location=?,founded_year=?,benefits=? WHERE user_id=?').run(e.description,e.email,e.phone,e.website,e.industry,e.size,e.location,e.founded,'HMO after regularization; paid leave; learning and development support.',u.id);
   // Keep the seeded company name stable and tied to this account.
   db.prepare('UPDATE company_profiles SET company_name=? WHERE user_id=?').run(e.company,u.id);
  } else {
   if (db.prepare('SELECT id FROM company_profiles WHERE company_name=? COLLATE NOCASE').get(e.company)) throw new Error('Company name already exists: '+e.company);
   addProfile.run(e.company,e.description,e.email,e.phone,e.website,e.industry,e.size,e.location,e.founded,'HMO after regularization; paid leave; learning and development support.',u.id);
  }
  employerIds.push(Number(u.id));
  const jobIds=[];
  for (const j of e.jobs) {
   let existing=db.prepare('SELECT id FROM jobs WHERE employer_id=? AND title=?').get(u.id,j.title);
   let id;
   if (existing) {
    id=Number(existing.id);
    db.prepare("UPDATE jobs SET description=?,company=?,location=?,category=?,salary=?,employment_type=?,responsibilities=?,qualifications=?,work_schedule=?,benefits=?,application_requirements=?,how_to_apply=?,contact_information=?,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(j.description,e.company,j.location,j.category,j.salary,j.type,j.responsibilities,j.qualifications,j.schedule,j.benefits,j.requirements,j.how,j.contact,id);
    db.prepare('DELETE FROM job_skills WHERE job_id=?').run(id);
   } else {
    const r=addJob.run(j.title,j.description,e.company,j.location,j.category,j.salary,j.type,j.responsibilities,j.qualifications,j.schedule,j.benefits,j.requirements,j.how,j.contact,u.id);
    id=Number(r.lastInsertRowid);
   }
   for (const name of j.skills) { insertSkill.run(name,'Demo Job Requirement'); const s=findSkill.get(name); if(s) addJobSkill.run(id,s.id); }
   jobIds.push(id);
  }
  jobsByEmployer.push(jobIds);
 }
 const candidateIds=[];
 for (const c of candidates) {
  let u=findUser.get(c.email);
  if (!u) { const r=addUser.run(c.name,c.email,HASH,c.education,c.degree,c.target,c.location,'candidate'); u={id:Number(r.lastInsertRowid)}; }
  else updateUser.run(c.name,HASH,c.education,c.degree,c.target,c.location,'candidate',u.id);
  candidateIds.push(Number(u.id));
  if (!db.prepare('SELECT id FROM education WHERE user_id=? AND school=? AND degree=?').get(u.id,c.school,c.degree)) db.prepare('INSERT INTO education (user_id,school,degree,field,year) VALUES (?,?,?,?,?)').run(u.id,c.school,c.degree,c.field,c.year);
  if (!db.prepare('SELECT id FROM experience WHERE user_id=? AND title=? AND company=?').get(u.id,c.expTitle,c.expCompany)) db.prepare('INSERT INTO experience (user_id,title,company,duration,description) VALUES (?,?,?,?,?)').run(u.id,c.expTitle,c.expCompany,c.duration,c.exp);
  for (const name of c.skills) { insertSkill.run(name,'Demo Candidate Skill'); const s=findSkill.get(name); if(s) addUserSkill.run(u.id,s.id); }
 }
 // Each candidate applies to two employers; every employer receives applications.
 for (let i=0;i<candidates.length;i++) {
  const targets=[{e:i,j:i%3},{e:(i+1)%employers.length,j:(i+1)%3}];
  for (const t of targets) {
   const jobId=jobsByEmployer[t.e][t.j], candidateId=candidateIds[i], employerId=employerIds[t.e];
   addApplication.run(jobId,candidateId);
   const app=db.prepare('SELECT id,status FROM applications WHERE job_id=? AND user_id=?').get(jobId,candidateId);
   if (!app) continue;
   if (!db.prepare('SELECT 1 FROM application_history WHERE application_id=? LIMIT 1').get(app.id)) addHistory.run(app.id,app.status);
   if (!db.prepare("SELECT 1 FROM messages WHERE application_id=? AND body LIKE 'DEMO:%' LIMIT 1").get(app.id)) {
    addMessage.run(app.id,candidateId,employerId,'DEMO: Hello! I recently applied for this position and would be happy to share more about my projects and experience.');
    addMessage.run(app.id,employerId,candidateId,'DEMO: Thanks for applying. We have received your application and will review your profile. Feel free to send us questions here.');
   }
  }
 }
});

try {
 runSeed();
 console.log('[demo-seed] Complete: 5 employers, 5 employees, 15 detailed jobs, 10 applications, and sample conversations.');
 console.log('[demo-seed] Shared password: '+PASSWORD);
 console.log('[demo-seed] Employer emails: '+employers.map(e=>e.email).join(', '));
 console.log('[demo-seed] Employee emails: '+candidates.map(c=>c.email).join(', '));
} catch (error) {
 console.error('[demo-seed] Failed; transaction rolled back:',error);
 process.exitCode=1;
} finally {
 db.close();
}
