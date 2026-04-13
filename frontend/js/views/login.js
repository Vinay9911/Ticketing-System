/* ════════════════════════════════════════════════════════
   VIEW — Login Page (Role Picker)
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
                <p class="login-subtitle">Select a user profile to enter the system</p>
                <div class="user-cards" id="login-user-cards">
                    <div class="empty-state"><div class="spinner"></div></div>
                </div>
            </div>
        </div>`;
    },

    async afterRender() {
        try {
            const data = await fetch('/api/v1/auth/users').then(r => r.json());
            const container = document.getElementById('login-user-cards');
            if (!container) return;

            container.innerHTML = data.users.map(u => `
                <div class="user-card" onclick='App.auth.login(${JSON.stringify(u).replace(/'/g, "\\'")})'>
                    <div class="user-card-avatar ${u.role}">${App.utils.initials(u.name)}</div>
                    <div class="user-card-name">${u.name}</div>
                    <div class="user-card-role ${u.role}">${u.role}</div>
                    <div class="user-card-dept">${u.department_name || ''}</div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    }
};
