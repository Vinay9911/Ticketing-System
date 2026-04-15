/* ════════════════════════════════════════════════════════
   VIEW — Admin Dashboard
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['dashboard-admin'] = {
    title: 'Admin Dashboard',

    render() {
        return `
        <div class="page-header"><h1>Dashboard Overview</h1></div>

        <!-- KPI Cards -->
        <div class="kpi-grid stagger-in" id="admin-kpis">
            ${this.kpiSkeleton(8)}
        </div>

        <!-- Charts -->
        <div class="chart-grid" id="admin-charts">
            <div class="chart-card"><div class="chart-card-title">Assets by Category</div><div class="chart-container"><canvas id="chart-assets-category"></canvas></div></div>
            <div class="chart-card"><div class="chart-card-title">Ticket Status Distribution</div><div class="chart-container"><canvas id="chart-ticket-status"></canvas></div></div>
            <div class="chart-card"><div class="chart-card-title">Tickets — Last 30 Days</div><div class="chart-container"><canvas id="chart-tickets-trend"></canvas></div></div>
        </div>

        <!-- Tables Row -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px">
            <div class="card">
                <div class="card-header"><span class="card-title">🔴 Open Critical Tickets</span></div>
                <div id="admin-critical-tickets"><div class="spinner"></div></div>
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">🔧 Upcoming Repairs / Maintenance</span></div>
                <div id="admin-repairs-upcoming"><div class="spinner"></div></div>
            </div>
        </div>`;
    },

    kpiSkeleton(count) {
        return Array(count).fill('<div class="kpi-card primary"><div class="kpi-content"><div class="skeleton skeleton-text" style="width:80px"></div><div class="skeleton skeleton-title" style="width:50px;height:28px"></div></div></div>').join('');
    },

    async afterRender() {
        const [assetStats, ticketStats, repairStats] = await Promise.all([
            App.api.get('/assets/stats').catch(()=>({})),
            App.api.get('/tickets/stats').catch(()=>({})),
            App.api.get('/repairs/stats').catch(()=>({}))
        ]);

        // KPI Cards
        document.getElementById('admin-kpis').innerHTML = `
            <a href="#/assets" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card primary kpi-hoverable"><div class="kpi-icon primary">📦</div><div class="kpi-content"><div class="kpi-label">Total Assets</div><div class="kpi-value">${assetStats.total || 0}</div></div></div></a>
            <a href="#/assets?status=available" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card success kpi-hoverable"><div class="kpi-icon success">✅</div><div class="kpi-content"><div class="kpi-label">Available</div><div class="kpi-value">${assetStats.available || 0}</div></div></div></a>
            <a href="#/assets?status=in_use" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card info kpi-hoverable"><div class="kpi-icon info">👤</div><div class="kpi-content"><div class="kpi-label">In Use</div><div class="kpi-value">${assetStats.inUse || 0}</div></div></div></a>
            <a href="#/assets?status=under_maintenance" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card warning kpi-hoverable"><div class="kpi-icon warning">🔧</div><div class="kpi-content"><div class="kpi-label">Under Maintenance</div><div class="kpi-value">${assetStats.underMaintenance || 0}</div></div></div></a>
            
            <a href="#/tickets" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card danger kpi-hoverable"><div class="kpi-icon danger">🎫</div><div class="kpi-content"><div class="kpi-label">Total Tickets</div><div class="kpi-value">${ticketStats.total || 0}</div></div></div></a>
            <a href="#/tickets?status=open" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card danger kpi-hoverable"><div class="kpi-icon danger">🔴</div><div class="kpi-content"><div class="kpi-label">Open Tickets</div><div class="kpi-value">${ticketStats.open || 0}</div></div></div></a>
            <a href="#/tickets?status=in_progress" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card warning kpi-hoverable"><div class="kpi-icon warning">⏳</div><div class="kpi-content"><div class="kpi-label">In Progress</div><div class="kpi-value">${ticketStats.inProgress || 0}</div></div></div></a>
            <a href="#/tickets" style="text-decoration:none;color:inherit;display:block"><div class="kpi-card info kpi-hoverable"><div class="kpi-icon info">⏱</div><div class="kpi-content"><div class="kpi-label">Avg Resolution</div><div class="kpi-value">${ticketStats.avgResolutionHours ? ticketStats.avgResolutionHours + 'h' : '—'}</div></div></div></a>
        `;

        // Add a subtle hover effect via JS or relying on existing CSS. We will add a small inline style tag if CSS class isn't present
        if (!document.getElementById('kpi-hover-style')) {
            const style = document.createElement('style');
            style.id = 'kpi-hover-style';
            style.innerHTML = `
                .kpi-hoverable:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); cursor: pointer; transition: all 0.2s ease; }
            `;
            document.head.appendChild(style);
        }

        // Charts
        this.renderCharts(assetStats, ticketStats);

        // Critical Tickets
        try {
            const { tickets } = await App.api.get('/tickets?priority=critical&status=open&limit=5');
            const el = document.getElementById('admin-critical-tickets');
            if (!tickets || tickets.length === 0) {
                el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No critical tickets 🎉</div></div>';
            } else {
                el.innerHTML = tickets.map(t => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
                        <div>
                            <a href="#/tickets/${t.id}" style="font-weight:600;font-size:0.88rem">${t.ticket_number}</a>
                            <div style="font-size:0.82rem;color:var(--text-secondary)">${App.utils.escapeHtml(t.title)}</div>
                        </div>
                        ${App.utils.priorityBadge(t.priority)}
                    </div>
                `).join('');
            }
        } catch (e) { /* ignore */ }

        // Repairs Due
        try {
            const { repairs } = await App.api.get('/repairs/upcoming');
            const el = document.getElementById('admin-repairs-upcoming');
            if (!repairs || repairs.length === 0) {
                el.innerHTML = '<div class="empty-state"><div class="empty-state-text">No upcoming repairs 🎉</div></div>';
            } else {
                el.innerHTML = repairs.map(r => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
                        <div>
                            <a href="#/repairs/${r.id}" style="font-weight:600;font-size:0.88rem">${App.utils.escapeHtml(r.asset_name)}</a>
                            <div style="font-size:0.82rem;color:var(--text-secondary)">Scheduled: ${App.utils.formatDate(r.repair_date)}</div>
                        </div>
                        ${App.utils.statusBadge(r.status)}
                    </div>
                `).join('');
            }
        } catch (e) { /* ignore */ }
    },

    renderCharts(assetStats, ticketStats) {
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

        // Assets by Category
        if (assetStats.byCategory && assetStats.byCategory.length > 0) {
            new Chart(document.getElementById('chart-assets-category'), {
                type: 'bar',
                data: {
                    labels: assetStats.byCategory.map(c => c.name),
                    datasets: [{ label: 'Assets', data: assetStats.byCategory.map(c => c.count), backgroundColor: colors, borderRadius: 6, borderSkipped: false }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }

        // Ticket Status
        if (ticketStats.byStatus && ticketStats.byStatus.length > 0) {
            const statusColors = { open: '#ef4444', in_progress: '#f59e0b', resolved: '#10b981', closed: '#94a3b8' };
            new Chart(document.getElementById('chart-ticket-status'), {
                type: 'doughnut',
                data: {
                    labels: ticketStats.byStatus.map(s => s.status.replace('_', ' ')),
                    datasets: [{ data: ticketStats.byStatus.map(s => s.count), backgroundColor: ticketStats.byStatus.map(s => statusColors[s.status] || '#6366f1'), borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
            });
        }

        // Tickets Trend
        if (ticketStats.last30Days && ticketStats.last30Days.length > 0) {
            new Chart(document.getElementById('chart-tickets-trend'), {
                type: 'line',
                data: {
                    labels: ticketStats.last30Days.map(d => d.date.slice(5)),
                    datasets: [{ label: 'Tickets', data: ticketStats.last30Days.map(d => d.count), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#6366f1' }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }
    }
};
