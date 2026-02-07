/* =============================================================================
   AIResQ ClimSols - Volunteer Page JavaScript
   ============================================================================= */

// =============================================================================
// TAB NAVIGATION
// =============================================================================

function showVolunteerTab(tab) {
    // Update buttons
    document.querySelectorAll('.tab-buttons .btn').forEach(btn => {
        btn.classList.remove('btn-primary', 'tab-active');
        btn.classList.add('btn-outline');
    });
    
    const activeBtn = document.querySelector(`.tab-buttons .btn:${tab === 'register' ? 'first-child' : 'last-child'}`);
    if (activeBtn) {
        activeBtn.classList.remove('btn-outline');
        activeBtn.classList.add('btn-primary', 'tab-active');
    }
    
    // Show/hide forms
    document.getElementById('volunteerRegister').classList.add('hidden');
    document.getElementById('volunteerSignin').classList.add('hidden');
    document.getElementById('volunteerDashboard').classList.add('hidden');
    
    if (tab === 'register') {
        document.getElementById('volunteerRegister').classList.remove('hidden');
    } else if (tab === 'signin') {
        document.getElementById('volunteerSignin').classList.remove('hidden');
    }
}

// =============================================================================
// FORM SUBMISSIONS
// =============================================================================

function initVolunteerForms() {
    const regForm = document.getElementById('volunteerRegForm');
    const signinForm = document.getElementById('volunteerSigninForm');
    
    if (regForm) {
        regForm.addEventListener('submit', async e => {
            e.preventDefault();
            const status = document.getElementById('regStatus');
            const btn = e.target.querySelector('button[type="submit"]');
            
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Registering...';
            
            const skills = Array.from(document.querySelectorAll('#skillsGroup input:checked')).map(i => i.value);
            const availability = document.querySelector('input[name="availability"]:checked')?.value || '';

            try {
                const r = await fetch('/api/volunteer/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: e.target.username.value,
                        phone: e.target.phone.value,
                        skills,
                        availability
                    })
                });
                const d = await r.json();
                
                if (d.ok) {
                    status.textContent = '✓ Registration successful! You can now sign in.';
                    status.className = 'status-msg success';
                    e.target.reset();
                    document.querySelectorAll('.checkbox-item').forEach(c => c.classList.remove('selected'));
                    document.querySelectorAll('.radio-item').forEach(r => r.classList.remove('selected'));
                } else {
                    throw new Error(d.error);
                }
            } catch (err) {
                status.textContent = '✗ ' + err.message;
                status.className = 'status-msg error';
            }
            
            status.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Register as Volunteer';
        });
    }

    if (signinForm) {
        signinForm.addEventListener('submit', async e => {
            e.preventDefault();
            const status = document.getElementById('signinStatus');
            const btn = e.target.querySelector('button[type="submit"]');
            
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Signing in...';
            
            try {
                const r = await fetch('/api/volunteer/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: e.target.phone.value })
                });
                const d = await r.json();
                
                if (d.ok) {
                    document.getElementById('volunteerSignin').classList.add('hidden');
                    document.getElementById('volunteerDashboard').classList.remove('hidden');
                    document.getElementById('volName').textContent = d.volunteer.username;
                    document.getElementById('volSkills').textContent = d.volunteer.skills?.join(', ') || 'None specified';
                    document.getElementById('volAvail').textContent = d.volunteer.availability || 'Not set';
                    
                    // Store in session
                    sessionStorage.setItem('volunteer', JSON.stringify(d.volunteer));
                } else {
                    throw new Error(d.error);
                }
            } catch (err) {
                status.textContent = '✗ ' + err.message;
                status.className = 'status-msg error';
                status.classList.remove('hidden');
            }
            
            btn.disabled = false;
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In';
        });
    }
}

function volunteerSignout() {
    sessionStorage.removeItem('volunteer');
    document.getElementById('volunteerDashboard').classList.add('hidden');
    document.getElementById('volunteerSignin').classList.remove('hidden');
    document.getElementById('signinStatus').classList.add('hidden');
    
    // Reset form
    const form = document.getElementById('volunteerSigninForm');
    if (form) form.reset();
}

// =============================================================================
// CHECK SESSION
// =============================================================================

function checkSession() {
    const volunteer = sessionStorage.getItem('volunteer');
    if (volunteer) {
        try {
            const v = JSON.parse(volunteer);
            document.getElementById('volunteerSignin').classList.add('hidden');
            document.getElementById('volunteerRegister').classList.add('hidden');
            document.getElementById('volunteerDashboard').classList.remove('hidden');
            document.getElementById('volName').textContent = v.username;
            document.getElementById('volSkills').textContent = v.skills?.join(', ') || 'None specified';
            document.getElementById('volAvail').textContent = v.availability || 'Not set';
        } catch (e) {
            sessionStorage.removeItem('volunteer');
        }
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initVolunteerForms();
    checkSession();
    
    console.log('AIResQ ClimSols Volunteer page initialized');
});
