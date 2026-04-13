/* ════════════════════════════════════════════════════════
   VIEW — Maintenance List
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['maintenance-list'] = {
    title: 'Maintenance Schedules',
    _page: 1, _status: '',

    render() {
        return `
        <div class="page-header">
            <h1>Maintenance Schedules</h1>
            <a href="#/maintenance/new" class="btn btn-primary">+ Schedule Maintenance</a>
        </div>

        <div class="kpi-grid stagger-in" id="maint-kpis"><div class="spinner"></div></div>

        <div class="filter-bar">
            <select class="filter-select" id="maint-status-filter">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
            </select>
        </div>

        <div class="card" style="padding:0">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Asset</th><th>Type</th><th>Scheduled Date</th><th>Assigned To</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody id="maint-table-body"><tr><td colspan="6"><div class="spinner"></div></td></tr></tbody>
                </table>
            </div>
            <div id="maint-pagination" style="padding:0 16px 8px"></div>
        </div>`;
    },

    async afterRender() {
        document.getElementById('maint-status-filter').addEventListener('change', (e) => { this._status = e.target.value; this._page = 1; this.loadSchedules(); });

        // Load stats
        try {
            const stats = await App.api.get('/maintenance/stats');
            document.getElementById('maint-kpis').innerHTML = `
                <div class="kpi-card warning"><div class="kpi-icon warning">⏳</div><div class="kpi-content"><div class="kpi-label">Pending</div><div class="kpi-value">${stats.pending}</div></div></div>
                <div class="kpi-card danger"><div class="kpi-icon danger">⚠</div><div class="kpi-content"><div class="kpi-label">Overdue</div><div class="kpi-value">${stats.overdue}</div></div></div>
                <div class="kpi-card success"><div class="kpi-icon success">✅</div><div class="kpi-content"><div class="kpi-label">Completed</div><div class="kpi-value">${stats.completed}</div></div></div>
                <div class="kpi-card info"><div class="kpi-icon info">🛡</div><div class="kpi-content"><div class="kpi-label">Warranty Expiring</div><div class="kpi-value">${stats.warrantyExpiring}</div></div></div>
            `;
        } catch(e) {}

        this.loadSchedules();
    },

    async loadSchedules() {
        try {
            let url = `/maintenance?page=${this._page}&limit=15`;
            if (this._status) url += `&status=${this._status}`;

            const { schedules, pagination } = await App.api.get(url);
            const tbody = document.getElementById('maint-table-body');
            const isAdmin = App.auth.hasRole('admin');

            if (schedules.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🔧</div><div class="empty-state-text">No maintenance schedules</div></div></td></tr>';
            } else {
                tbody.innerHTML = schedules.map(s => `
                    <tr>
                        <td><strong>${App.utils.escapeHtml(s.asset_name || '—')}</strong><br><span style="font-size:0.78rem;color:var(--text-muted)">${s.serial_number || ''}</span></td>
                        <td>${App.utils.escapeHtml(s.maintenance_type || 'General')}</td>
                        <td>${App.utils.formatDate(s.scheduled_date)}</td>
                        <td>${s.assigned_to_name || '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
                        <td>${App.utils.statusBadge(s.status)}</td>
                        <td>
                            <div class="table-actions">
                                ${s.status === 'pending' || s.status === 'overdue' ? `<button class="btn btn-success btn-sm" onclick="App.views['maintenance-list'].markComplete(${s.id})">✓ Complete</button>` : ''}
                                ${isAdmin ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="App.views['maintenance-list'].deleteSchedule(${s.id})">Del</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
            document.getElementById('maint-pagination').innerHTML = App.utils.paginationHTML(pagination, "App.views['maintenance-list'].goToPage");
        } catch(e) {}
    },

    goToPage(p) { this._page = p; this.loadSchedules(); },

    async markComplete(id) {
        if (!App.utils.confirm('Mark this maintenance as complete? Asset will revert to Available status.')) return;
        try {
            await App.api.put(`/maintenance/${id}/complete`, {});
            App.utils.toast('Maintenance completed!', 'success');
            App.router.resolve();
        } catch(e) {}
    },

    async deleteSchedule(id) {
        if (!App.utils.confirm('Delete this schedule?')) return;
        try { await App.api.del(`/maintenance/${id}`); App.utils.toast('Deleted', 'success'); this.loadSchedules(); } catch(e) {}
    }
};
