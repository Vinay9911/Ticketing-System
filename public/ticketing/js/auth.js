/* ════════════════════════════════════════════════════════
   AUTH — JWT Login / Logout / Session Management
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

App.auth = {
    async login(email) {
        try {
            const response = await fetch('/api/ticketing/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (!response.ok) {
                App.utils.toast(data.error || 'Login failed', 'error');
                return false;
            }

            App.state.setToken(data.token);
            App.state.setUser(data.user);
            App.utils.toast(`Welcome, ${data.user.name}!`, 'success');
            window.location.hash = '#/dashboard';
            return true;
        } catch (err) {
            App.utils.toast('Login failed: ' + err.message, 'error');
            return false;
        }
    },

    logout() {
        App.state.clearUser();
        window.location.hash = '#/login';
    },

    requireAuth() {
        if (!App.state.isLoggedIn()) {
            window.location.hash = '#/login';
            return false;
        }
        return true;
    },

    hasRole(...roles) {
        const user = App.state.getUser();
        return user && roles.includes(user.role);
    }
};