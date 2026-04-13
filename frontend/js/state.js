/* ════════════════════════════════════════════════════════
   STATE — Simple global state store
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

App.state = {
    user: null,

    setUser(userData) {
        this.user = userData;
        localStorage.setItem('ams_user', JSON.stringify(userData));
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

    clearUser() {
        this.user = null;
        localStorage.removeItem('ams_user');
    },

    isLoggedIn() {
        return !!this.getUser();
    }
};
