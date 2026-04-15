/* ════════════════════════════════════════════════════════
   VIEW — Login Page (Email-based JWT Login)
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['login'] = {
    title: 'Login',

    render() {
        return `
        <div class="login-page">
            <div class="login-container">
                <div class="login-brand">
                    <div class="login-brand-icon">📦</div>
                    <h1>Asset Management System</h1>
                    <p>Track assets, manage tickets, stay organized</p>
                </div>
                <form id="login-form" class="login-form" onsubmit="return false;">
                    <div class="form-group">
                        <label for="login-email" class="form-label">Email Address</label>
                        <input type="email" id="login-email" class="form-input" placeholder="Enter your email (e.g. admin@test.com)" required autofocus>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block" id="login-btn">
                        Sign In
                    </button>
                    <p class="login-hint" style="margin-top:16px;font-size:0.82rem;color:var(--text-muted);text-align:center;">
                        This is a micro-module of the main application.<br>
                        Enter an email registered in the system to authenticate.
                    </p>
                </form>
            </div>
        </div>`;
    },

    async afterRender() {
        const form = document.getElementById('login-form');
        const btn = document.getElementById('login-btn');
        const emailInput = document.getElementById('login-email');

        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) return;

            btn.disabled = true;
            btn.textContent = 'Signing in...';

            const success = await App.auth.login(email);
            if (!success) {
                btn.disabled = false;
                btn.textContent = 'Sign In';
            }
        });
    }
};
