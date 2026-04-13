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
                    <a href="#/tickets" class="btn btn-sm btn-outline">View All</a>
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
            App.api.get('/assets/stats'),
            App.api.get('/tickets/stats')
        ]);

        document.getElementById('staff-kpis').innerHTML = `
            <div class="kpi-card primary"><div class="kpi-icon primary">📦</div><div class="kpi-content"><div class="kpi-label">My Assets</div><div class="kpi-value">${assetStats.total}</div></div></div>
            <div class="kpi-card danger"><div class="kpi-icon danger">🔴</div><div class="kpi-content"><div class="kpi-label">Open Tickets</div><div class="kpi-value">${ticketStats.open}</div></div></div>
            <div class="kpi-card warning"><div class="kpi-icon warning">⏳</div><div class="kpi-content"><div class="kpi-label">In Progress</div><div class="kpi-value">${ticketStats.inProgress}</div></div></div>
            <div class="kpi-card success"><div class="kpi-icon success">✅</div><div class="kpi-content"><div class="kpi-label">Resolved</div><div class="kpi-value">${ticketStats.resolved}</div></div></div>
        `;

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
                            <a href="#/assets/${a.id}" style="font-weight:600">${a.name}</a>
                            <div style="font-size:0.82rem;color:var(--text-secondary)">${a.category_name || ''} ${a.serial_number ? '• ' + a.serial_number : ''}</div>
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
                            <span style="color:var(--text-secondary);font-size:0.85rem"> — ${t.title}</span>
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
                            <div style="font-weight:600;font-size:0.88rem">${n.title}</div>
                            <div style="font-size:0.82rem;color:var(--text-secondary)">${n.message}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${App.utils.timeAgo(n.created_at)}</div>
                        </div>
                    </div>`).join('');
            }
        } catch(e) {}
    }
};
