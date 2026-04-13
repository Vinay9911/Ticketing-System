/* ════════════════════════════════════════════════════════
   VIEW — Audit Logs
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['audit-logs'] = {
    title: 'Audit Logs',
    _page: 1, _module: '', _action: '', _userId: '',

    render() {
        return `
        <div class="page-header"><h1>Audit Logs</h1><span class="badge badge-danger">Admin Only</span></div>

        <div class="filter-bar">
            <select class="filter-select" id="audit-module-filter"><option value="">All Modules</option></select>
            <select class="filter-select" id="audit-action-filter"><option value="">All Actions</option></select>
            <input type="date" class="filter-select" id="audit-date-from" style="padding:8px 12px" title="From date">
            <input type="date" class="filter-select" id="audit-date-to" style="padding:8px 12px" title="To date">
        </div>

        <div class="card" style="padding:0">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Timestamp</th><th>User</th><th>Module</th><th>Action</th><th>Record ID</th><th>Details</th></tr></thead>
                    <tbody id="audit-table-body"><tr><td colspan="6"><div class="spinner"></div></td></tr></tbody>
                </table>
            </div>
            <div id="audit-pagination" style="padding:0 16px 8px"></div>
        </div>`;
    },

    async afterRender() {
        document.getElementById('audit-module-filter').addEventListener('change', (e) => { this._module = e.target.value; this._page = 1; this.load(); });
        document.getElementById('audit-action-filter').addEventListener('change', (e) => { this._action = e.target.value; this._page = 1; this.load(); });
        document.getElementById('audit-date-from').addEventListener('change', () => { this._page = 1; this.load(); });
        document.getElementById('audit-date-to').addEventListener('change', () => { this._page = 1; this.load(); });
        this.load();
    },

    async load() {
        try {
            let url = `/audit-logs?page=${this._page}&limit=20`;
            if (this._module) url += `&module=${this._module}`;
            if (this._action) url += `&action=${this._action}`;
            const dateFrom = document.getElementById('audit-date-from')?.value;
            const dateTo = document.getElementById('audit-date-to')?.value;
            if (dateFrom) url += `&date_from=${dateFrom}`;
            if (dateTo) url += `&date_to=${dateTo}`;

            const { logs, modules, actions, pagination } = await App.api.get(url);

            // Populate filter dropdowns (only first time)
            const modSel = document.getElementById('audit-module-filter');
            if (modSel.options.length <= 1) {
                modules.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; modSel.appendChild(o); });
            }
            const actSel = document.getElementById('audit-action-filter');
            if (actSel.options.length <= 1) {
                actions.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; actSel.appendChild(o); });
            }

            const tbody = document.getElementById('audit-table-body');
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-text">No audit logs found</div></div></td></tr>';
            } else {
                tbody.innerHTML = logs.map(l => {
                    const moduleColors = { asset: 'primary', ticket: 'warning', maintenance: 'success', user: 'info' };
                    const actionColors = { create: 'success', update: 'info', delete: 'danger', assign: 'warning', complete: 'success' };
                    return `
                    <tr>
                        <td style="font-size:0.82rem;color:var(--text-secondary);white-space:nowrap">${App.utils.formatDateTime(l.created_at)}</td>
                        <td><div style="display:flex;align-items:center;gap:8px">${App.utils.avatar(l.user_name, l.user_role, 26)} <span style="font-size:0.85rem">${l.user_name || 'System'}</span></div></td>
                        <td><span class="badge badge-${moduleColors[l.module] || 'muted'}">${l.module}</span></td>
                        <td><span class="badge badge-${actionColors[l.action] || 'muted'}">${l.action}</span></td>
                        <td style="font-family:var(--font-mono);font-size:0.82rem">#${l.record_id}</td>
                        <td><button class="btn btn-ghost btn-sm" onclick="App.views['audit-logs'].showDiff(${l.id}, '${App.utils.escapeHtml(l.old_data || '')}', '${App.utils.escapeHtml(l.new_data || '')}')">View Diff</button></td>
                    </tr>`;
                }).join('');
            }
            document.getElementById('audit-pagination').innerHTML = App.utils.paginationHTML(pagination, "App.views['audit-logs'].goToPage");
        } catch(e) {}
    },

    goToPage(p) { this._page = p; this.load(); },

    showDiff(id, oldData, newData) {
        let oldObj, newObj;
        try { oldObj = oldData ? JSON.parse(oldData) : null; } catch { oldObj = oldData; }
        try { newObj = newData ? JSON.parse(newData) : null; } catch { newObj = newData; }

        const formatJson = (obj) => {
            if (!obj) return '<span style="color:var(--text-muted)">null</span>';
            if (typeof obj === 'string') return `<pre style="white-space:pre-wrap;font-size:0.82rem;font-family:var(--font-mono);margin:0">${App.utils.escapeHtml(obj)}</pre>`;
            return `<pre style="white-space:pre-wrap;font-size:0.82rem;font-family:var(--font-mono);margin:0;background:var(--bg-hover);padding:12px;border-radius:var(--radius-sm)">${App.utils.escapeHtml(JSON.stringify(obj, null, 2))}</pre>`;
        };

        const body = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div><h4 style="margin-bottom:8px;color:var(--danger)">⬅ Before</h4>${formatJson(oldObj)}</div>
                <div><h4 style="margin-bottom:8px;color:var(--success)">➡ After</h4>${formatJson(newObj)}</div>
            </div>`;

        App.utils.showModal(`Audit Log #${id} — Data Diff`, body);
    }
};
