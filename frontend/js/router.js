/* ════════════════════════════════════════════════════════
   ROUTER — Hash-based SPA routing
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

App.router = {
    routes: {},
    currentView: null,

    register(path, viewName) {
        this.routes[path] = viewName;
    },

    init() {
        window.addEventListener('hashchange', () => this.resolve());
        this.resolve();
    },

    navigate(path) {
        window.location.hash = '#' + path;
    },

    resolve() {
        const hash = window.location.hash.slice(1) || '/login';
        const { path, params } = this.matchRoute(hash);

        // Auth guard — all routes except login require auth
        if (path !== '/login' && !App.state.isLoggedIn()) {
            window.location.hash = '#/login';
            return;
        }

        // If logged in and trying to go to login, redirect to dashboard
        if (path === '/login' && App.state.isLoggedIn()) {
            window.location.hash = '#/dashboard';
            return;
        }

        // Resolve dashboard to role-specific dashboard
        let viewName = this.routes[path];

        if (path === '/dashboard') {
            const user = App.state.getUser();
            viewName = `dashboard-${user.role}`;
        }

        if (!viewName) {
            viewName = this.routes[path];
        }

        if (!viewName || !App.views[viewName]) {
            console.warn(`No view found for route: ${path} (view: ${viewName})`);
            this.render404();
            return;
        }

        this.renderView(viewName, params, path);
    },

    matchRoute(hash) {
        // Exact match first
        if (this.routes[hash]) return { path: hash, params: {} };

        // Pattern matching for :id params
        for (const pattern of Object.keys(this.routes)) {
            const patternParts = pattern.split('/');
            const hashParts = hash.split('/');

            if (patternParts.length !== hashParts.length) continue;

            const params = {};
            let match = true;

            for (let i = 0; i < patternParts.length; i++) {
                if (patternParts[i].startsWith(':')) {
                    params[patternParts[i].slice(1)] = hashParts[i];
                } else if (patternParts[i] !== hashParts[i]) {
                    match = false;
                    break;
                }
            }

            if (match) return { path: pattern, params };
        }

        return { path: hash, params: {} };
    },

    async renderView(viewName, params, path) {
        const view = App.views[viewName];
        const content = document.getElementById('main-content');

        // Update layout for login vs app pages
        if (viewName === 'login') {
            document.getElementById('app').innerHTML = view.render(params);
            if (view.afterRender) await view.afterRender(params);
            return;
        }

        // Ensure app shell is rendered
        if (!content) {
            App.renderShell();
            await this.renderView(viewName, params, path);
            return;
        }

        content.innerHTML = `<div class="view-enter">${view.render(params)}</div>`;

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('data-route');
            if (href && (path === href || path.startsWith(href + '/'))) {
                link.classList.add('active');
            }
        });

        // Update topbar title
        const titles = {
            '/dashboard': 'Dashboard', '/assets': 'Assets', '/assets/new': 'Add New Asset',
            '/categories': 'Asset Categories', '/maintenance': 'Maintenance',
            '/maintenance/new': 'Schedule Maintenance', '/tickets': 'Tickets',
            '/tickets/new': 'Create Ticket', '/notifications': 'Notifications',
            '/reports': 'Reports', '/audit-logs': 'Audit Logs'
        };
        const titleEl = document.getElementById('topbar-page-title');
        if (titleEl) titleEl.textContent = titles[path] || view.title || 'Page';

        if (view.afterRender) await view.afterRender(params);

        // Update notification count
        App.updateNotificationCount();
    },

    render404() {
        const content = document.getElementById('main-content');
        if (content) {
            content.innerHTML = `<div class="empty-state" style="padding-top:100px">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">Page Not Found</div>
                <div class="empty-state-sub">The page you're looking for doesn't exist.</div>
                <button class="btn btn-primary" style="margin-top:16px" onclick="location.hash='#/dashboard'">Go to Dashboard</button>
            </div>`;
        }
    }
};
