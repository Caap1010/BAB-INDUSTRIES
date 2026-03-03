(() => {
    const userStorageKey = 'babDriverAppUser';
    const sessionStorageKey = 'babDriverAppSession';
    const roleButtons = document.querySelectorAll('.role-btn');
    const roleField = document.getElementById('accountRole');
    const selectedRoleText = document.getElementById('selectedRole');
    const signupForm = document.getElementById('signupForm');
    const signupInputs = signupForm
        ? signupForm.querySelectorAll('input:not([type="hidden"])')
        : [];
    const signupSubmit = document.getElementById('signupSubmit');
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    const logoutButtons = document.querySelectorAll('[data-logout]');
    const isDashboardPage = document.body.dataset.dashboard === 'true';
    const requiredRole = document.body.dataset.role;
    const welcomeMessage = document.getElementById('welcomeMessage');
    const homeDashboardBtn = document.getElementById('homeDashboardBtn');
    const homeSessionStatus = document.getElementById('homeSessionStatus');

    function routeByRole(role) {
        if (role === 'driver') {
            window.location.href = 'driver-dashboard.html';
            return;
        }
        window.location.href = 'client-dashboard.html';
    }

    function getSession() {
        const storedSession = localStorage.getItem(sessionStorageKey);
        if (!storedSession) {
            return null;
        }

        try {
            return JSON.parse(storedSession);
        } catch (error) {
            localStorage.removeItem(sessionStorageKey);
            return null;
        }
    }

    function enableSignupFields() {
        signupInputs.forEach((input) => {
            input.disabled = false;
        });
        if (signupSubmit) {
            signupSubmit.disabled = false;
        }
    }

    roleButtons.forEach((button) => {
        button.addEventListener('click', () => {
            roleButtons.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');

            const role = button.dataset.role;
            if (roleField) {
                roleField.value = role;
            }

            if (selectedRoleText) {
                selectedRoleText.textContent = `Selected role: ${role}`;
            }

            enableSignupFields();
        });
    });

    if (signupForm) {
        signupForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const role = roleField ? roleField.value : '';
            if (!role) {
                if (selectedRoleText) {
                    selectedRoleText.textContent = 'Please choose Driver or Client first.';
                }
                return;
            }

            const payload = {
                fullName: document.getElementById('signupName').value.trim(),
                email: document.getElementById('signupEmail').value.trim().toLowerCase(),
                password: document.getElementById('signupPassword').value,
                role,
            };

            localStorage.setItem(userStorageKey, JSON.stringify(payload));
            if (selectedRoleText) {
                selectedRoleText.textContent = 'Account created. You can now login.';
            }
            signupForm.reset();
            signupInputs.forEach((input) => {
                input.disabled = true;
            });
            if (signupSubmit) {
                signupSubmit.disabled = true;
            }
            roleButtons.forEach((item) => item.classList.remove('active'));
            if (roleField) {
                roleField.value = '';
            }

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 700);
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const stored = localStorage.getItem(userStorageKey);
            if (!stored) {
                loginMessage.textContent = 'No account found. Please sign up first.';
                return;
            }

            const account = JSON.parse(stored);
            const email = document.getElementById('loginEmail').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value;

            if (account.email === email && account.password === password) {
                localStorage.setItem(sessionStorageKey, JSON.stringify({
                    fullName: account.fullName,
                    email: account.email,
                    role: account.role,
                }));
                loginMessage.textContent = `Login successful as ${account.role}. Redirecting...`;
                setTimeout(() => {
                    routeByRole(account.role);
                }, 500);
            } else {
                loginMessage.textContent = 'Invalid email or password.';
            }
        });
    }

    logoutButtons.forEach((button) => {
        button.addEventListener('click', () => {
            localStorage.removeItem(sessionStorageKey);
            window.location.href = 'index.html';
        });
    });

    if (homeDashboardBtn) {
        const session = getSession();
        if (session && session.role) {
            homeDashboardBtn.classList.remove('hidden');
            homeDashboardBtn.href = session.role === 'driver'
                ? 'driver-dashboard.html'
                : 'client-dashboard.html';

            if (homeSessionStatus) {
                homeSessionStatus.textContent = `Logged in as ${session.fullName || session.role}.`;
            }
        } else if (homeSessionStatus) {
            homeSessionStatus.textContent = 'Not logged in yet.';
        }
    }

    if (isDashboardPage) {
        const session = getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }

        if (session.role !== requiredRole) {
            routeByRole(session.role);
            return;
        }

        if (welcomeMessage) {
            const label = requiredRole === 'driver' ? 'Driver' : 'Client';
            welcomeMessage.textContent = `Welcome, ${session.fullName || label}.`;
        }
    }
})();