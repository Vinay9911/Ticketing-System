/* ════════════════════════════════════════════════════════
   AUTH — Login / Logout / Session Management
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

App.auth = {
    login(user) {
        App.state.setUser({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            departmentId: user.department_id,
            departmentName: user.department_name
        });
        App.utils.toast(`Welcome, ${user.name}!`, 'success');
        window.location.hash = '#/dashboard';
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