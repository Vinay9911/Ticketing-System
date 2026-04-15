/* ════════════════════════════════════════════════════════
   VIEW — Staff Dashboard
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['dashboard-staff'] = {
    title: 'My Dashboard',

    render() {
        const user = App.state.getUser();
        return `
        <div class="page-header"><h1>Welcome, ${user.name}</h1></div>

        <div class="kpi-grid stagger-in" id="staff-kpis"><div class="spinner"></div></div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px">
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📦 My Assets</span>
                    <a href="#/assets" class="btn btn-sm btn-outline">View All</a>
                </div>
                <div id="staff-assets"><div class="spinner"></div></div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">🎫 My Tickets</span>
                    <a href="#/tickets?filter=my" class="btn btn-sm btn-outline">View All</a>
                </div>
                <div id="staff-tickets"><div class="spinner"></div></div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><span class="card-title">Quick Actions</span></div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <a href="#/tickets/new" class="btn btn-primary">+ Raise New Ticket</a>
                <a href="#/assets" class="btn btn-outline">View My Assets</a>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><span class="card-title">📬 Recent Notifications</span></div>
            <div id="staff-notifications"><div class="spinner"></div></div>
        </div>`;
    },

    async afterRender() {
        const user = App.state.getUser();

        const [assetStats, ticketStats] = await Promise.all([
            App.api.get('/assets/stats').catch(()=>({})),
            App.api.get('/tickets/stats').catch(()=>({}))
        ]);

        document.getElementById('staff-kpis').innerHTML = `
            <a href="#/assets" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card primary kpi-hoverable"><div class="kpi-icon primary">📦</div><div class="kpi-content"><div class="kpi-label">My Assets</div><div class="kpi-value">${assetStats.total || 0}</div></div></div></a>
            <a href="#/tickets?filter=my&status=open" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card danger kpi-hoverable"><div class="kpi-icon danger">🔴</div><div class="kpi-content"><div class="kpi-label">Open Tickets</div><div class="kpi-value">${ticketStats.open || 0}</div></div></div></a>
            <a href="#/tickets?filter=my&status=in_progress" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card warning kpi-hoverable"><div class="kpi-icon warning">⏳</div><div class="kpi-content"><div class="kpi-label">In Progress</div><div class="kpi-value">${ticketStats.inProgress || 0}</div></div></div></a>
            <a href="#/tickets?filter=my&status=resolved" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card success kpi-hoverable"><div class="kpi-icon success">✅</div><div class="kpi-content"><div class="kpi-label">Resolved</div><div class="kpi-value">${ticketStats.resolved || 0}</div></div></div></a>
        `;

        if (!document.getElementById('kpi-hover-style')) {
            const style = document.createElement('style');
            style.id = 'kpi-hover-style';
            style.innerHTML = '.kpi-hoverable:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); cursor: pointer; transition: all 0.2s ease; }';
            document.head.appendChild(style);
        }

        // My Assets
        try {
            const { assets } = await App.api.get('/assets?limit=5');
            const el = document.getElementById('staff-assets');
            if (assets.length === 0) {
                el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No assets assigned to you</div></div>';
            } else {
                el.innerHTML = assets.map(a => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
                        <div>
                            <a href="#/assets/${a.id}" style="font-weight:600">${App.utils.escapeHtml(a.name)}</a>
                            <div style="font-size:0.82rem;color:var(--text-secondary)">${App.utils.escapeHtml(a.category_name || '')} ${a.serial_number ? '• ' + a.serial_number : ''}</div>
                        </div>
                        ${App.utils.statusBadge(a.status)}
                    </div>`).join('');
            }
        } catch(e) {}

        // My Tickets
        try {
            const { tickets } = await App.api.get('/tickets?limit=5');
            const el = document.getElementById('staff-tickets');
            if (tickets.length === 0) {
                el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No tickets yet</div><a href="#/tickets/new" class="btn btn-primary btn-sm" style="margin-top:8px">Raise a Ticket</a></div>';
            } else {
                el.innerHTML = tickets.map(t => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
                        <div>
                            <a href="#/tickets/${t.id}" style="font-weight:600">${t.ticket_number}</a>
                            <span style="color:var(--text-secondary);font-size:0.85rem"> — ${App.utils.escapeHtml(t.title)}</span>
                        </div>
                        <div style="display:flex;gap:6px">${App.utils.priorityBadge(t.priority)} ${App.utils.statusBadge(t.status)}</div>
                    </div>`).join('');
            }
        } catch(e) {}

        // Recent Notifications
        try {
            const { notifications } = await App.api.get('/notifications?limit=5');
            const el = document.getElementById('staff-notifications');
            if (notifications.length === 0) {
                el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No notifications</div></div>';
            } else {
                el.innerHTML = notifications.map(n => `
                    <div style="display:flex;align-items:start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light);opacity:${n.is_read ? '0.6' : '1'}">
                        <div style="width:8px;height:8px;border-radius:50%;background:${n.is_read ? 'var(--border)' : 'var(--primary)'};margin-top:6px;flex-shrink:0"></div>
                        <div>
                            <div style="font-weight:600;font-size:0.88rem">${App.utils.escapeHtml(n.title)}</div>
                            <div style="font-size:0.82rem;color:var(--text-secondary)">${App.utils.escapeHtml(n.message)}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${App.utils.timeAgo(n.created_at)}</div>
                        </div>
                    </div>`).join('');
            }
        } catch(e) {}
    }
};
