'use strict';

/* =========================================================
   PROFILE PAGE
   ========================================================= */

const savedSkillsView =
    document.querySelector('#savedSkillsView');

const skillsEditor =
    document.querySelector('#skillsEditor');

const savedSkillsContainer =
    document.querySelector('#savedSkillsContainer');

const skillsContainer =
    document.querySelector('#skillsContainer');

const savedSkillCount =
    document.querySelector('#savedSkillCount');

const selectedSkillCount =
    document.querySelector('#selectedSkillCount');

const editSkillsButton =
    document.querySelector('#editSkillsButton');

const cancelSkillsButton =
    document.querySelector('#cancelSkillsButton');

const saveProfileSkillsButton =
    document.querySelector('#saveProfileSkills');

const profileSaveMessage =
    document.querySelector('#profileSaveMessage');

const profileSkillsCard =
    document.querySelector('.profile-skills-card');

const savedJobsList =
    document.querySelector('#savedJobsList');

const savedJobCount =
    document.querySelector('#savedJobCount');


let profileData = null;
let allSkills = [];

let selectedSkillIds = new Set();
let savedSkillIds = new Set();

let editorOpen = false;


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function getInitials(name) {
    const parts = String(name || 'Account')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return 'A';
    }

    return parts
        .slice(0, 2)
        .map((part) =>
            part.charAt(0).toUpperCase()
        )
        .join('');
}


function getSkillIds(skillList) {
    return new Set(
        (Array.isArray(skillList) ? skillList : [])
            .map((skill) => Number(skill.id))
            .filter(
                (id) =>
                    Number.isInteger(id) &&
                    id > 0
            )
    );
}


function groupSkills(skillList) {
    const groups = {};

    for (const skill of skillList) {
        const category =
            skill.category || 'Other';

        if (!groups[category]) {
            groups[category] = [];
        }

        groups[category].push(skill);
    }

    return groups;
}


function updateSelectedCount() {
    if (selectedSkillCount) {
        selectedSkillCount.textContent =
            `${selectedSkillIds.size} selected`;
    }
}


/* =========================================================
   PROFILE INFORMATION
   ========================================================= */

function renderProfileInformation() {
    if (!profileData) {
        return;
    }

    const name =
        profileData.full_name || 'Account';

    const email =
        profileData.email || '—';

    const profileName =
        document.querySelector('#profileName');

    const profileEmail =
        document.querySelector('#profileEmail');

    const profileAvatar =
        document.querySelector('#profileAvatar');

    const profileEducation =
        document.querySelector('#profileEducation');

    const profileDegree =
        document.querySelector('#profileDegree');

    const profileTargetJob =
        document.querySelector('#profileTargetJob');

    const profileLocation =
        document.querySelector('#profileLocation');

    const headerUserName =
        document.querySelector('#headerUserName');


    if (profileName) {
        profileName.textContent = name;
    }

    if (profileEmail) {
        profileEmail.textContent = email;
    }

    if (profileAvatar) {
        profileAvatar.textContent =
            getInitials(name);
    }

    if (profileEducation) {
        profileEducation.textContent =
            profileData.education ||
            'Not provided';
    }

    if (profileDegree) {
        profileDegree.textContent =
            profileData.degree ||
            'Not provided';
    }

    if (profileTargetJob) {
        profileTargetJob.textContent =
            profileData.target_job ||
            'Not provided';
    }

    if (profileLocation) {
        profileLocation.textContent =
            profileData.location ||
            'Not provided';
    }

    if (headerUserName) {
        headerUserName.textContent = name;
    }
}


/* =========================================================
   SAVED JOBS
   ========================================================= */

function renderSavedJobs(jobs) {
    if (!savedJobsList) {
        return;
    }

    if (savedJobCount) {
        savedJobCount.textContent =
            `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}`;
    }

    if (!jobs.length) {
        savedJobsList.innerHTML = `
            <div class="profile-saved-jobs-empty">
                No saved jobs yet. Save an opportunity from the jobs page.
            </div>
        `;
        return;
    }

    savedJobsList.innerHTML = jobs.map((job) => `
        <article class="profile-saved-job-item">
            <div>
                <h3>${escapeHTML(job.title)}</h3>
                <p>${escapeHTML(job.company || 'Company not listed')}</p>
                <span>
                    ${escapeHTML(job.location || 'Remote')}
                    ${job.employment_type ? ` · ${escapeHTML(job.employment_type)}` : ''}
                    ${job.salary ? ` · ${escapeHTML(job.salary)}` : ''}
                </span>
            </div>

            <button
                type="button"
                class="profile-remove-job-button"
                data-job-id="${Number(job.id)}"
            >
                Remove
            </button>
        </article>
    `).join('');
}


async function loadSavedJobs() {
    if (!savedJobsList) {
        return;
    }

    try {
        const response = await fetch(
            '/api/jobs/saved',
            { credentials: 'include' }
        );

        if (!response.ok) {
            throw new Error('Failed to load saved jobs.');
        }

        const data = await response.json();
        renderSavedJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (error) {
        savedJobsList.innerHTML = `
            <div class="profile-saved-jobs-empty">
                Unable to load saved jobs right now.
            </div>
        `;

        console.error('[profile] Failed to load saved jobs:', error);
    }
}


async function removeSavedJob(jobId) {
    const response = await fetch(
        `/api/jobs/saved/${jobId}`,
        {
            method: 'DELETE',
            credentials: 'include'
        }
    );

    if (!response.ok) {
        throw new Error('Failed to remove saved job.');
    }

    loadSavedJobs();
}


/* =========================================================
   SAVED SKILLS VIEW
   ========================================================= */

function renderSavedSkills(editing = false) {
    if (!savedSkillsContainer) {
        return;
    }

    const savedSkills =
        Array.isArray(profileData?.skills)
            ? profileData.skills
            : [];

    if (!editing) {
        savedSkillIds =
            getSkillIds(savedSkills);
    }

    const visibleSkills = editing
        ? savedSkills.filter((skill) =>
            selectedSkillIds.has(Number(skill.id))
        )
        : savedSkills;


    if (savedSkillCount) {
        savedSkillCount.textContent =
            `${savedSkills.length} ${
                savedSkills.length === 1
                    ? 'skill'
                    : 'skills'
            }`;
    }


    if (!visibleSkills.length) {
        savedSkillsContainer.innerHTML = `
            <div class="profile-saved-skills-empty">
                ${editing
                    ? 'No saved skills remain.'
                    : 'No skills saved yet. Click <strong>Edit Skills</strong> to add your skills.'}
            </div>
        `;

        return;
    }


    savedSkillsContainer.innerHTML =
        visibleSkills
            .map(
                (skill) => `
                    <span class="profile-saved-skill-bubble${
                        editing ? ' is-editing' : ''
                    }">
                        ${escapeHTML(skill.name)}
                        ${editing ? `
                            <button
                                type="button"
                                class="profile-remove-saved-skill"
                                data-skill-id="${Number(skill.id)}"
                                aria-label="Remove ${escapeHTML(skill.name)}"
                            >
                                ×
                            </button>
                        ` : ''}
                    </span>
                `
            )
            .join('');
}


/* =========================================================
   EDITOR
   ========================================================= */

function renderSkillEditor() {
    if (!skillsContainer) {
        return;
    }


    if (!allSkills.length) {
        skillsContainer.innerHTML = `
            <div class="profile-empty-state">
                <div class="profile-empty-icon">
                    🛠️
                </div>

                <h3>No skills available</h3>

                <p>
                    We could not load the available
                    skills right now.
                </p>
            </div>
        `;

        updateSelectedCount();

        return;
    }


    const groups =
        groupSkills(allSkills);


    skillsContainer.innerHTML =
        Object.entries(groups)
            .map(
                ([category, categorySkills]) => `
                    <section class="profile-skill-group">

                        <h3 class="profile-skill-category">
                            ${escapeHTML(category)}
                        </h3>

                        <div class="profile-skill-list">

                            ${categorySkills
                                .map((skill) => {
                                    const id =
                                        Number(skill.id);

                                    const selected =
                                        selectedSkillIds.has(
                                            id
                                        );

                                    return `
                                        <button
                                            type="button"
                                            class="profile-skill-button${
                                                selected
                                                    ? ' selected'
                                                    : ''
                                            }"
                                            data-skill-id="${id}"
                                            aria-pressed="${selected}"
                                        >

                                            <span class="profile-skill-check">
                                                ${
                                                    selected
                                                        ? '✓'
                                                        : ''
                                                }
                                            </span>

                                            <span>
                                                ${escapeHTML(
                                                    skill.name
                                                )}
                                            </span>

                                        </button>
                                    `;
                                })
                                .join('')}

                        </div>

                    </section>
                `
            )
            .join('');


    updateSelectedCount();
}


/* =========================================================
   CARD CASCADE ANIMATION
   ========================================================= */

/*
   This animates the actual card height.

   IMPORTANT:
   We do NOT use max-height.

   The card first gets its current real height.
   Then the view changes.
   Then we wait for the browser to render the
   new content before measuring the new height.

   This prevents the giant white-space bug.
*/

function animateSkillsCard(updateView) {
    if (!profileSkillsCard) {
        updateView();
        return;
    }


    /* Get the card's current rendered height. */
    const startHeight =
        profileSkillsCard.getBoundingClientRect()
            .height;


    /*
       Freeze the card at its current height
       before changing the content.
    */
    profileSkillsCard.style.height =
        `${startHeight}px`;

    profileSkillsCard.style.overflow =
        'hidden';

    /*
       Change saved/editor state.
    */
    updateView();


    /*
       Wait for the browser to apply the new
       visibility/layout before measuring.
    */
    requestAnimationFrame(() => {

        requestAnimationFrame(() => {

            /*
               scrollHeight now represents the
               newly visible content.
            */
            const targetHeight =
                profileSkillsCard.scrollHeight;


            profileSkillsCard.style.transition =
                'height 0.9s cubic-bezier(0.22, 1, 0.36, 1)';


            profileSkillsCard.style.height =
                `${targetHeight}px`;
        });
    });


    /*
       Once the height animation finishes,
       remove the inline height.

       This is important because otherwise the
       card can get permanently stuck at the
       measured pixel height.
    */
    const finish = (event) => {

        if (event.propertyName !== 'height') {
            return;
        }


        profileSkillsCard.style.height = '';
        profileSkillsCard.style.overflow = '';
        profileSkillsCard.style.transition = '';


        profileSkillsCard.removeEventListener(
            'transitionend',
            finish
        );
    };


    profileSkillsCard.addEventListener(
        'transitionend',
        finish
    );
}


function closeSkillsEditor(updateView) {
    if (!profileSkillsCard || !skillsEditor) {
        updateView();
        return;
    }


    const startHeight =
        profileSkillsCard.getBoundingClientRect()
            .height;


    profileSkillsCard.style.height =
        `${startHeight}px`;

    profileSkillsCard.style.overflow =
        'hidden';

    /* Commit the open height before measuring the saved layout. */
    void profileSkillsCard.offsetHeight;

    skillsEditor.classList.add('is-closing');
    updateView();

    if (savedSkillsView) {
        savedSkillsView.classList.add('is-restoring');
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const cardStyles =
                window.getComputedStyle(profileSkillsCard);

            const verticalPadding =
                parseFloat(cardStyles.paddingTop) +
                parseFloat(cardStyles.paddingBottom);

            const targetHeight =
                savedSkillsView.offsetHeight +
                verticalPadding;

            profileSkillsCard.style.transition =
                'height 1.3s cubic-bezier(0.22, 1, 0.36, 1)';

            profileSkillsCard.style.height =
                `${targetHeight}px`;
        });
    });

    const finish = (event) => {
        if (event.propertyName !== 'height') {
            return;
        }

        skillsEditor.classList.remove('is-closing');

        if (savedSkillsView) {
            savedSkillsView.classList.remove('is-restoring');
        }

        profileSkillsCard.style.height = '';
        profileSkillsCard.style.overflow = '';
        profileSkillsCard.style.transition = '';

        profileSkillsCard.removeEventListener(
            'transitionend',
            finish
        );
    };

    profileSkillsCard.addEventListener(
        'transitionend',
        finish
    );
}


/* =========================================================
   SHOW SAVED VIEW
   ========================================================= */

function showSavedView(animate = true) {
    const wasEditorOpen = editorOpen;

    editorOpen = false;


    const updateView = () => {

        if (savedSkillsView) {
            if (savedSkillsContainer) {
                savedSkillsView.append(savedSkillsContainer);
            }

            savedSkillsView.classList.remove(
                'is-hidden',
                'is-skills-editing'
            );

            savedSkillsView.setAttribute(
                'aria-hidden',
                'false'
            );
        }


        if (skillsEditor) {
            skillsEditor.classList.remove(
                'is-open'
            );

            skillsEditor.setAttribute(
                'aria-hidden',
                'true'
            );
        }
    };


    if (animate && wasEditorOpen) {
        closeSkillsEditor(updateView);
    } else if (animate) {
        animateSkillsCard(updateView);
    } else {
        updateView();
    }


    if (profileSaveMessage) {
        profileSaveMessage.textContent = '';

        profileSaveMessage.className =
            'profile-save-message';
    }
}


/* =========================================================
   SHOW EDITOR VIEW
   ========================================================= */

function showEditorView() {
    editorOpen = true;


    animateSkillsCard(() => {

        if (savedSkillsView) {
            savedSkillsView.classList.remove(
                'is-hidden',
                'is-restoring'
            );

            savedSkillsView.classList.add(
                'is-skills-editing'
            );

            savedSkillsView.setAttribute(
                'aria-hidden',
                'false'
            );
        }

        if (savedSkillsContainer && skillsEditor) {
            const editorHeading =
                skillsEditor.querySelector('.profile-card-heading');

            if (editorHeading) {
                editorHeading.after(savedSkillsContainer);
            }
        }


        if (skillsEditor) {
            skillsEditor.classList.add(
                'is-open'
            );

            skillsEditor.setAttribute(
                'aria-hidden',
                'false'
            );
        }
    });
}


/* =========================================================
   OPEN SKILL EDITOR
   ========================================================= */

function openSkillEditor() {

    /*
       Start editing with the currently saved
       skills selected.
    */
    selectedSkillIds =
        new Set(savedSkillIds);

    renderSavedSkills(true);


    if (profileSaveMessage) {
        profileSaveMessage.textContent = '';

        profileSaveMessage.className =
            'profile-save-message';
    }


    /*
       Render the selector before the card
       animation begins so the correct height
       can be measured.
    */
    renderSkillEditor();

    showEditorView();
}


/* =========================================================
   CANCEL SKILL EDITOR
   ========================================================= */

function cancelSkillEditor() {

    /*
       Throw away unsaved changes.
    */
    selectedSkillIds =
        new Set(savedSkillIds);


    renderSavedSkills();

    showSavedView();
}


function removeSavedSkillWhileEditing(skillId) {
    if (!editorOpen || !selectedSkillIds.has(skillId)) {
        return;
    }

    selectedSkillIds.delete(skillId);
    renderSavedSkills(true);

    const skillButton =
        skillsContainer?.querySelector(
            `[data-skill-id="${skillId}"]`
        );

    if (skillButton) {
        skillButton.classList.remove('selected');
        skillButton.setAttribute('aria-pressed', 'false');

        const check =
            skillButton.querySelector('.profile-skill-check');

        if (check) {
            check.textContent = '';
        }
    }

    updateSelectedCount();
}


/* =========================================================
   TOGGLE SKILL
   ========================================================= */

function toggleSkill(button) {

    const skillId =
        Number(button.dataset.skillId);


    if (
        !Number.isInteger(skillId) ||
        skillId <= 0
    ) {
        return;
    }


    if (selectedSkillIds.has(skillId)) {

        selectedSkillIds.delete(skillId);

    } else {

        selectedSkillIds.add(skillId);
    }


    const selected =
        selectedSkillIds.has(skillId);


    button.classList.toggle(
        'selected',
        selected
    );


    button.setAttribute(
        'aria-pressed',
        String(selected)
    );


    const check =
        button.querySelector(
            '.profile-skill-check'
        );


    if (check) {
        check.textContent =
            selected ? '✓' : '';
    }


    updateSelectedCount();
}


/* =========================================================
   SAVE SKILLS
   ========================================================= */

async function saveProfileSkills() {

    if (!saveProfileSkillsButton) {
        return;
    }


    saveProfileSkillsButton.disabled =
        true;

    saveProfileSkillsButton.textContent =
        'Saving...';


    if (profileSaveMessage) {
        profileSaveMessage.textContent = '';

        profileSaveMessage.className =
            'profile-save-message';
    }


    try {

        const response =
            await fetch(
                '/api/auth/profile/skills',
                {
                    method: 'PUT',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    credentials: 'include',

                    body: JSON.stringify({
                        skillIds: [
                            ...selectedSkillIds
                        ]
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                'Failed to save skills.'
            );
        }


        profileData.skills =
            Array.isArray(data.skills)
                ? data.skills
                : [];


        savedSkillIds =
            getSkillIds(
                profileData.skills
            );


        selectedSkillIds =
            new Set(savedSkillIds);


        renderSavedSkills();


        if (profileSaveMessage) {

            profileSaveMessage.textContent =
                'Skills saved successfully!';

            profileSaveMessage.className =
                'profile-save-message success';
        }


        /*
           Give the success message a moment
           before contracting the card.
        */
        setTimeout(() => {
            showSavedView();
        }, 350);


    } catch (error) {

        console.error(
            '[profile] Save skills error:',
            error
        );


        if (profileSaveMessage) {

            profileSaveMessage.textContent =
                error.message ||
                'Failed to save skills.';

            profileSaveMessage.className =
                'profile-save-message error';
        }

    } finally {

        saveProfileSkillsButton.disabled =
            false;

        saveProfileSkillsButton.textContent =
            'Save Skills';
    }
}


/* =========================================================
   LOAD PROFILE
   ========================================================= */

async function loadProfile() {

    try {

        const [
            profileResponse,
            skillsResponse
        ] = await Promise.all([

            fetch(
                '/api/auth/profile',
                {
                    credentials: 'include'
                }
            ),

            fetch(
                '/api/auth/skills',
                {
                    credentials: 'include'
                }
            )
        ]);


        if (!profileResponse.ok) {

            if (
                profileResponse.status === 401
            ) {
                window.location.href = '/';
                return;
            }


            throw new Error(
                'Failed to load profile.'
            );
        }


        const profileResult =
            await profileResponse.json();


        const skillsResult =
            await skillsResponse.json();


        profileData =
            profileResult.profile || {};


        allSkills =
            Array.isArray(
                skillsResult.skills
            )
                ? skillsResult.skills
                : [];


        savedSkillIds =
            getSkillIds(
                profileData.skills
            );


        selectedSkillIds =
            new Set(savedSkillIds);


        renderProfileInformation();

        renderSavedSkills();

        renderSkillEditor();

        loadSavedJobs();


        /*
           IMPORTANT:
           Initial page load does NOT animate.
           This prevents the profile card from
           randomly expanding on page load.
        */
        showSavedView(false);


        console.log(
            '[profile] Profile loaded successfully.'
        );


    } catch (error) {

        console.error(
            '[profile] Failed to load profile:',
            error
        );


        const profileName =
            document.querySelector(
                '#profileName'
            );

        const profileEmail =
            document.querySelector(
                '#profileEmail'
            );


        if (profileName) {
            profileName.textContent =
                'Unable to load profile';
        }


        if (profileEmail) {
            profileEmail.textContent =
                error.message ||
                'Please try again.';
        }
    }
}


/* =========================================================
   HEADER / MOBILE NAV
   ========================================================= */

function initHeader() {

    const profileButton =
        document.querySelector(
            '#headerProfileButton'
        );

    const logoutButton =
        document.querySelector(
            '#headerLogoutButton'
        );

    const mobileLogoutButton =
        document.querySelector(
            '#mobileLogoutButton'
        );

    const menuToggle =
        document.querySelector(
            '#menuToggle'
        );

    const mobileMenu =
        document.querySelector(
            '#mobileMenu'
        );


    if (profileButton) {

        profileButton.addEventListener(
            'click',
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });

            }
        );
    }


    async function logout() {

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
                '[profile] Logout error:',
                error
            );

        } finally {

            window.location.href = '/';
        }
    }


    if (logoutButton) {

        logoutButton.addEventListener(
            'click',
            logout
        );
    }


    if (mobileLogoutButton) {

        mobileLogoutButton.addEventListener(
            'click',
            logout
        );
    }


    if (
        menuToggle &&
        mobileMenu
    ) {

        menuToggle.addEventListener(
            'click',
            () => {

                const open =
                    mobileMenu.classList.toggle(
                        'open'
                    );


                menuToggle.setAttribute(
                    'aria-expanded',
                    String(open)
                );
            }
        );
    }
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

if (editSkillsButton) {

    editSkillsButton.addEventListener(
        'click',
        openSkillEditor
    );
}


if (cancelSkillsButton) {

    cancelSkillsButton.addEventListener(
        'click',
        cancelSkillEditor
    );
}


if (saveProfileSkillsButton) {

    saveProfileSkillsButton.addEventListener(
        'click',
        saveProfileSkills
    );
}


if (savedJobsList) {
    savedJobsList.addEventListener(
        'click',
        async (event) => {
            const removeButton =
                event.target.closest('.profile-remove-job-button');

            if (!removeButton) {
                return;
            }

            removeButton.disabled = true;

            try {
                await removeSavedJob(
                    Number(removeButton.dataset.jobId)
                );
            } catch (error) {
                removeButton.disabled = false;
                console.error(
                    '[profile] Failed to remove saved job:',
                    error
                );
            }
        }
    );
}


if (skillsContainer) {

    skillsContainer.addEventListener(
        'click',
        (event) => {

            const button =
                event.target.closest(
                    '.profile-skill-button'
                );


            if (
                !button ||
                !skillsContainer.contains(button)
            ) {
                return;
            }


            toggleSkill(button);
        }
    );
}


if (savedSkillsContainer) {
    savedSkillsContainer.addEventListener(
        'click',
        (event) => {
            const removeButton =
                event.target.closest(
                    '.profile-remove-saved-skill'
                );

            if (!removeButton) {
                return;
            }

            removeSavedSkillWhileEditing(
                Number(removeButton.dataset.skillId)
            );
        }
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        initHeader();

        loadProfile();
    }
);