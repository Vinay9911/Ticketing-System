/* ════════════════════════════════════════════════════════
   VIEW — Repair List
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['repair-list'] = {
    title: 'All Repairs',
    _page: 1, _search: '', _status: '',

    render() {
        return `
        <div class="page-header">
            <h1>Repairs</h1>
            <a href="#/repairs/new" class="btn btn-primary">+ Schedule Repair</a>
        </div>

        <div class="filter-bar">
            <div class="search-input-wrapper"><span class="search-icon">🔍</span>
                <input type="text" id="repair-search" placeholder="Search by asset name..." value="${this._search}">
            </div>
            <select class="filter-select" id="repair-status-filter">
                <option value="">All Status</option>
                <option value="scheduled" ${this._status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                <option value="in_progress" ${this._status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${this._status === 'completed' ? 'selected' : ''}>Completed</option>
                <option value="cancelled" ${this._status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
        </div>

        <div class="card" style="padding:0">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Asset</th><th>Repair Date</th><th>Status</th><th>Approval</th><th>Provider</th><th>Cost</th></tr></thead>
                    <tbody id="repair-table-body"><tr><td colspan="6"><div class="spinner"></div></td></tr></tbody>
                </table>
            </div>
            <div id="repair-pagination" style="padding:0 16px 8px"></div>
        </div>`;
    },

    async afterRender() {
        let debounce;
        document.getElementById('repair-search').addEventListener('input', (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this._search = e.target.value; this._page = 1; this.loadRepairs(); }, 400);
        });
        document.getElementById('repair-status-filter').addEventListener('change', (e) => { this._status = e.target.value; this._page = 1; this.loadRepairs(); });
        this.loadRepairs();
    },

    async loadRepairs() {
        try {
            let url = `/repairs?page=${this._page}&limit=15`;
            if (this._search) url += `&search=${encodeURIComponent(this._search)}`;
            if (this._status) url += `&status=${this._status}`;

            const { repairs, pagination } = await App.api.get(url);
            const tbody = document.getElementById('repair-table-body');
            const isAdmin = App.auth.hasRole('admin');

            if (repairs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🔧</div><div class="empty-state-text">No repairs found</div></div></td></tr>';
            } else {
                tbody.innerHTML = repairs.map(r => `
                    <tr>
                        <td>
                            <div style="font-weight:600">${App.utils.escapeHtml(r.asset_name)}</div>
                            ${r.asset_serial ? `<div style="font-size:0.82rem;color:var(--text-secondary)">${r.asset_serial}</div>` : ''}
                        </td>
                        <td>${App.utils.formatDate(r.repair_date)}</td>
                        <td>${App.utils.statusBadge(r.status)}</td>
                        <td>
                            ${r.requires_approval ? (r.is_approved ? '<span class="badge badge-success">Approved</span>' : '<span class="badge badge-warning">Pending</span>') : '<span class="badge">N/A</span>'}
                        </td>
                        <td style="font-size:0.88rem">${r.provider || '—'}</td>
                        <td>${r.estimated_cost ? App.utils.formatCurrency(r.estimated_cost) : '—'}</td>
                    </tr>
                `).join('');
            }
            document.getElementById('repair-pagination').innerHTML = App.utils.paginationHTML(pagination, "App.views['repair-list'].goToPage");
        } catch(e) {}
    },

    goToPage(p) { this._page = p; this.loadRepairs(); },

    async deleteRepair(id) {
        if (!App.utils.confirm('Delete this repair record?')) return;
        try { await App.api.del(`/repairs/${id}`); App.utils.toast('Deleted', 'success'); this.loadRepairs(); } catch(e) {}
    }
};
