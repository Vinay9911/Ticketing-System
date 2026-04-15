/* ════════════════════════════════════════════════════════
   VIEW — Manager Dashboard
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['dashboard-manager'] = {
    title: 'Manager Dashboard',

    render() {
        const user = App.state.getUser();
        return `
        <div class="page-header"><h1>Department Overview</h1><span class="badge badge-warning">${user.departmentName || 'My Department'}</span></div>

        <div class="kpi-grid stagger-in" id="mgr-kpis"><div class="spinner"></div></div>

        <div class="chart-grid">
            <div class="chart-card"><div class="chart-card-title">Asset Status in Department</div><div class="chart-container"><canvas id="chart-mgr-assets"></canvas></div></div>
            <div class="chart-card"><div class="chart-card-title">Ticket Priority Breakdown</div><div class="chart-container"><canvas id="chart-mgr-priority"></canvas></div></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px">
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📋 Unassigned Tickets</span>
                    <a href="#/tickets" class="btn btn-sm btn-outline">View All</a>
                </div>
                <div id="mgr-unassigned"><div class="spinner"></div></div>
            </div>
            <div class="card">
                <div class="card-header">
                    <span class="card-title">🔧 Upcoming Repairs</span>
                    <a href="#/repairs" class="btn btn-sm btn-outline">View All</a>
                </div>
                <div id="mgr-repairs"><div class="spinner"></div></div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><span class="card-title">Quick Actions</span></div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <a href="#/tickets/new" class="btn btn-primary">+ Create Ticket</a>
                <a href="#/repairs/new" class="btn btn-warning">+ Schedule Repair</a>
                <a href="#/assets" class="btn btn-outline">View Department Assets</a>
            </div>
        </div>`;
    },

    async afterRender() {
        const [assetStats, ticketStats] = await Promise.all([
            App.api.get('/assets/stats').catch(()=>({})),
            App.api.get('/tickets/stats').catch(()=>({}))
        ]);

        document.getElementById('mgr-kpis').innerHTML = `
            <a href="#/assets" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card primary kpi-hoverable"><div class="kpi-icon primary">📦</div><div class="kpi-content"><div class="kpi-label">Dept Assets</div><div class="kpi-value">${assetStats.total || 0}</div></div></div></a>
            <a href="#/assets?status=available" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card success kpi-hoverable"><div class="kpi-icon success">✅</div><div class="kpi-content"><div class="kpi-label">Available</div><div class="kpi-value">${assetStats.available || 0}</div></div></div></a>
            <a href="#/assets?status=in_use" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card info kpi-hoverable"><div class="kpi-icon info">👤</div><div class="kpi-content"><div class="kpi-label">In Use</div><div class="kpi-value">${assetStats.inUse || 0}</div></div></div></a>
            <a href="#/assets?status=under_maintenance" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card warning kpi-hoverable"><div class="kpi-icon warning">🔧</div><div class="kpi-content"><div class="kpi-label">Under Maintenance</div><div class="kpi-value">${assetStats.underMaintenance || 0}</div></div></div></a>
            
            <a href="#/tickets" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card danger kpi-hoverable"><div class="kpi-icon danger">🎫</div><div class="kpi-content"><div class="kpi-label">Dept Tickets</div><div class="kpi-value">${ticketStats.total || 0}</div></div></div></a>
            <a href="#/tickets?status=open" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card danger kpi-hoverable"><div class="kpi-icon danger">🔴</div><div class="kpi-content"><div class="kpi-label">Open</div><div class="kpi-value">${ticketStats.open || 0}</div></div></div></a>
        `;

        if (!document.getElementById('kpi-hover-style')) {
            const style = document.createElement('style');
            style.id = 'kpi-hover-style';
            style.innerHTML = '.kpi-hoverable:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); cursor: pointer; transition: all 0.2s ease; }';
            document.head.appendChild(style);
        }

        // Charts
        const statusColors = { available: '#10b981', in_use: '#3b82f6', under_maintenance: '#f59e0b', retired: '#94a3b8' };
        if (assetStats.byCategory?.length) {
            new Chart(document.getElementById('chart-mgr-assets'), {
                type: 'bar',
                data: { labels: ['Available', 'In Use', 'Maintenance', 'Retired'], datasets: [{ data: [assetStats.available||0, assetStats.inUse||0, assetStats.underMaintenance||0, assetStats.retired||0], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#94a3b8'], borderRadius: 6 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }

        const priorityColors = { low: '#3b82f6', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed' };
        if (ticketStats.byPriority?.length) {
            new Chart(document.getElementById('chart-mgr-priority'), {
                type: 'doughnut',
                data: { labels: ticketStats.byPriority.map(p => p.priority), datasets: [{ data: ticketStats.byPriority.map(p => p.count), backgroundColor: ticketStats.byPriority.map(p => priorityColors[p.priority] || '#6366f1'), borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
            });
        }

        // Unassigned tickets
        try {
            const { tickets } = await App.api.get('/tickets?limit=5');
            const unassigned = tickets.filter(t => !t.assigned_to && t.status === 'open');
            const el = document.getElementById('mgr-unassigned');
            if (unassigned.length === 0) {
                el.innerHTML = '<div class="empty-state"><div class="empty-state-text">All department tickets assigned 👍</div></div>';
            } else {
                el.innerHTML = unassigned.map(t => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
                        <div><a href="#/tickets/${t.id}" style="font-weight:600">${t.ticket_number}</a> <span style="color:var(--text-secondary);font-size:0.85rem">— ${App.utils.escapeHtml(t.title)}</span></div>
                        ${App.utils.priorityBadge(t.priority)}
                    </div>`).join('');
            }
        } catch(e) {}

        // Upcoming repairs
        try {
            const { repairs } = await App.api.get('/repairs/upcoming');
            const el = document.getElementById('mgr-repairs');
            if (!repairs || repairs.length === 0) {
                el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No upcoming repairs</div></div>';
            } else {
                el.innerHTML = repairs.slice(0, 5).map(r => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
                        <div><span style="font-weight:600">${App.utils.escapeHtml(r.asset_name)}</span> <span style="color:var(--text-secondary);font-size:0.85rem">— ${App.utils.formatDate(r.repair_date)}</span></div>
                        ${App.utils.statusBadge(r.status)}
                    </div>`).join('');
            }
        } catch(e) {}
    }
};
