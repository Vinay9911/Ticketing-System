/* ════════════════════════════════════════════════════════
   APP — SPA Initialization, Shell Layout, Route Registration
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

// ─── Render App Shell (Sidebar + Topbar + Content) ────────
App.renderShell = function () {
    const user = App.state.getUser();
    if (!user) return;

    const role = user.role;
    const isAdmin = role === 'admin';
    const isManager = role === 'manager';

    const navItems = [
        { label: '📊 Dashboard', route: '/dashboard', roles: ['admin', 'manager', 'staff'] },
        { type: 'label', label: 'ASSETS', roles: ['admin', 'manager', 'staff'] },
        { label: '📦 All Assets', route: '/assets', roles: ['admin', 'manager', 'staff'] },
        { label: '➕ Add Asset', route: '/assets/new', roles: ['admin'] },
        { label: '🏷️ Categories', route: '/categories', roles: ['admin'] },
        { type: 'label', label: 'REPAIRS', roles: ['admin', 'manager'] },
        { label: '🔧 All Repairs', route: '/repairs', roles: ['admin', 'manager'] },
        { label: '📅 New Repair', route: '/repairs/new', roles: ['admin', 'manager'] },
        { type: 'label', label: 'TICKETS', roles: ['admin', 'manager', 'staff'] },
        { label: '🎫 All Tickets', route: '/tickets', roles: ['admin', 'manager', 'staff'] },
        { label: '🎫 My Tickets', route: '/tickets?filter=my', roles: ['admin', 'manager', 'staff'] },
        { label: '✏️ Create Ticket', route: '/tickets/new', roles: ['admin', 'manager', 'staff'] },
        { type: 'label', label: 'INSIGHTS', roles: ['admin', 'manager'] },
        { label: '📈 Reports', route: '/reports', roles: ['admin', 'manager'] },
        { label: '📋 Audit Logs', route: '/audit-logs', roles: ['admin'] },
    ];

    const navHTML = navItems
        .filter(item => item.roles.includes(role))
        .map(item => {
            if (item.type === 'label') return `<div class="nav-section-label">${item.label}</div>`;
            return `<a class="nav-link" data-route="${item.route}" href="#${item.route}">${item.label}</a>`;
        }).join('');

    document.getElementById('app').innerHTML = `
        <div class="app-layout">
            <div class="sidebar-overlay" id="sidebar-overlay"></div>
            <nav class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-logo">
                        <div class="sidebar-logo-icon">📦</div>
                        <div>
                            <div class="sidebar-logo-text">Asset Manager</div>
                            <div class="sidebar-logo-sub">Ticketing System</div>
                        </div>
                    </div>
                </div>
                <div class="sidebar-nav">
                    ${navHTML}
                    <div class="nav-spacer"></div>
                    <a class="nav-link" data-route="/notifications" href="#/notifications">
                        🔔 Notifications <span class="badge badge-danger" id="nav-notif-badge" style="margin-left:auto;display:none">0</span>
                    </a>
                    <a class="nav-link logout" href="javascript:void(0)" onclick="App.auth.logout()">🚪 Logout</a>
                </div>
            </nav>

            <div class="main-wrapper">
                <header class="topbar">
                    <button class="topbar-hamburger" id="hamburger-btn" onclick="App.toggleSidebar()">☰</button>
                    <span class="topbar-title" id="topbar-page-title">Dashboard</span>
                    <div class="topbar-actions">
                        <button class="topbar-btn" onclick="location.hash='#/notifications'" title="Notifications">
                            🔔
                            <span class="notification-badge hidden" id="topbar-notif-count">0</span>
                        </button>
                        <div class="topbar-user">
                            <div class="topbar-avatar">${App.utils.initials(user.name)}</div>
                            <div class="topbar-user-info">
                                <div class="topbar-user-name">${user.name}</div>
                                <div class="topbar-user-role">${user.role}</div>
                            </div>
                        </div>
                    </div>
                </header>
                <div class="content-area" id="main-content">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>`;

    // Sidebar overlay for mobile
    document.getElementById('sidebar-overlay').addEventListener('click', () => App.toggleSidebar());
};

// ─── Toggle mobile sidebar ───────────────────────────────
App.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
};

// ─── Update notification count in bell icon + nav ────────
App.updateNotificationCount = async function () {
    try {
        const { count } = await App.api.get('/notifications/unread-count');
        const topbarBadge = document.getElementById('topbar-notif-count');
        const navBadge = document.getElementById('nav-notif-badge');
        if (topbarBadge) {
            topbarBadge.textContent = count;
            topbarBadge.classList.toggle('hidden', count === 0);
        }
        if (navBadge) {
            navBadge.textContent = count;
            navBadge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    } catch (e) { /* ignore */ }
};

// ─── Register all routes ─────────────────────────────────
App.router.register('/login', 'login');
App.router.register('/dashboard', 'dashboard'); // resolved dynamically
App.router.register('/assets', 'asset-list');
App.router.register('/assets/new', 'asset-form');
App.router.register('/assets/:id', 'asset-detail');
App.router.register('/assets/:id/edit', 'asset-form');
App.router.register('/categories', 'asset-categories');
App.router.register('/repairs', 'repair-list');
App.router.register('/repairs/new', 'repair-form');
App.router.register('/tickets', 'ticket-list');
App.router.register('/tickets/new', 'ticket-form');
App.router.register('/tickets/:id', 'ticket-detail');
App.router.register('/notifications', 'notifications');
App.router.register('/reports', 'reports');
App.router.register('/audit-logs', 'audit-logs');

// ─── Start the app ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    App.router.init();

    // Poll notification count every 60 seconds
    setInterval(() => {
        if (App.state.isLoggedIn()) App.updateNotificationCount();
    }, 60000);
});
