/* ════════════════════════════════════════════════════════
   STATE — Simple global state store with JWT support
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

App.state = {
    user: null,
    token: null,

    setUser(userData) {
        this.user = userData;
        localStorage.setItem('ams_user', JSON.stringify(userData));
    },

    setToken(token) {
        this.token = token;
        localStorage.setItem('ams_token', token);
    },

    getUser() {
        if (this.user) return this.user;
        const stored = localStorage.getItem('ams_user');
        if (stored) {
            this.user = JSON.parse(stored);
            return this.user;
        }
        return null;
    },

    getToken() {
        if (this.token) return this.token;
        const stored = localStorage.getItem('ams_token');
        if (stored) {
            this.token = stored;
            return this.token;
        }
        return null;
    },

    clearUser() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('ams_user');
        localStorage.removeItem('ams_token');
    },

    isLoggedIn() {
        return !!this.getUser() && !!this.getToken();
    }
};
