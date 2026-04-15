/* ════════════════════════════════════════════════════════
   VIEW — Asset List
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['asset-list'] = {
    title: 'All Assets',
    _page: 1,
    _search: '',
    _status: '',
    _category: '',

    render() {
        const isAdmin = App.auth.hasRole('admin');
        return `
        <div class="page-header">
            <h1>Asset Inventory</h1>
            <div class="page-header-actions">
                ${isAdmin ? '<a href="#/assets/new" class="btn btn-primary">+ Add Asset</a>' : ''}
                ${isAdmin ? '<a href="#/categories" class="btn btn-outline">Categories</a>' : ''}
            </div>
        </div>

        <div class="filter-bar">
            <div class="search-input-wrapper">
                <span class="search-icon">🔍</span>
                <input type="text" id="asset-search" placeholder="Search by name, serial number..." value="${this._search}">
            </div>
            <select class="filter-select" id="asset-status-filter">
                <option value="">All Status</option>
                <option value="available" ${this._status === 'available' ? 'selected' : ''}>Available</option>
                <option value="in_use" ${this._status === 'in_use' ? 'selected' : ''}>In Use</option>
                <option value="under_maintenance" ${this._status === 'under_maintenance' ? 'selected' : ''}>Under Maintenance</option>
                <option value="retired" ${this._status === 'retired' ? 'selected' : ''}>Retired</option>
            </select>
            <select class="filter-select" id="asset-category-filter">
                <option value="">All Categories</option>
            </select>
        </div>

        <div class="card" style="padding:0">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Serial No.</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Location</th>
                            <th>Assigned To</th>
                            <th>Cost</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="asset-table-body">
                        <tr><td colspan="8"><div class="spinner"></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="asset-pagination" style="padding:0 16px 8px"></div>
        </div>`;
    },

    async afterRender() {
        // Load categories for filter
        try {
            const { categories } = await App.api.get('/assets/categories');
            const sel = document.getElementById('asset-category-filter');
            categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id; opt.textContent = c.name;
                if (String(c.id) === this._category) opt.selected = true;
                sel.appendChild(opt);
            });
        } catch(e) {}

        // Event listeners
        let debounce;
        document.getElementById('asset-search').addEventListener('input', (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this._search = e.target.value; this._page = 1; this.loadAssets(); }, 400);
        });
        document.getElementById('asset-status-filter').addEventListener('change', (e) => { this._status = e.target.value; this._page = 1; this.loadAssets(); });
        document.getElementById('asset-category-filter').addEventListener('change', (e) => { this._category = e.target.value; this._page = 1; this.loadAssets(); });

        this.loadAssets();
    },

    async loadAssets() {
        try {
            let url = `/assets?page=${this._page}&limit=15`;
            if (this._search) url += `&search=${encodeURIComponent(this._search)}`;
            if (this._status) url += `&status=${this._status}`;
            if (this._category) url += `&category_id=${this._category}`;

            const { assets, pagination } = await App.api.get(url);
            const tbody = document.getElementById('asset-table-body');
            const isAdmin = App.auth.hasRole('admin');
            const isManager = App.auth.hasRole('admin', 'manager');

            if (assets.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No assets found</div></div></td></tr>';
            } else {
                tbody.innerHTML = assets.map(a => `
                    <tr>
                        <td><a href="#/assets/${a.id}" style="font-weight:600;color:var(--primary)">${App.utils.escapeHtml(a.name)}</a></td>
                        <td style="font-family:var(--font-mono);font-size:0.82rem;color:var(--text-secondary)">${a.serial_number || '—'}</td>
                        <td>${a.category_name || '—'}</td>
                        <td>${App.utils.statusBadge(a.status)}</td>
                        <td style="font-size:0.85rem;color:var(--text-secondary)">${a.location || '—'}</td>
                        <td>${a.assigned_user_name || a.dept_name || '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
                        <td style="font-weight:500">${App.utils.formatCurrency(a.cost)}</td>
                        <td>
                            <div class="table-actions">
                                <a href="#/assets/${a.id}" class="btn btn-ghost btn-sm">View</a>
                                ${isAdmin ? `<a href="#/assets/${a.id}/edit" class="btn btn-ghost btn-sm">Edit</a>` : ''}
                                ${isManager && a.status === 'available' ? `<button class="btn btn-ghost btn-sm" onclick="App.views['asset-list'].showAssign(${a.id}, '${App.utils.escapeHtml(a.name)}')">Assign</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('');
            }

            document.getElementById('asset-pagination').innerHTML = App.utils.paginationHTML(pagination, "App.views['asset-list'].goToPage");
        } catch(e) {}
    },

    goToPage(page) {
        this._page = page;
        this.loadAssets();
    },

    async showAssign(assetId, assetName) {
        const { users } = await App.api.get('/users');
        const { departments } = await App.api.get('/users/departments');

        const body = `
            <p style="margin-bottom:16px">Assign <strong>${assetName}</strong> to:</p>
            <div class="form-group">
                <label class="form-label">Employee</label>
                <select class="form-control" id="assign-user-select">
                    <option value="">— Select Employee —</option>
                    ${users.map(u => `<option value="${u.id}">${u.name} (${u.role} — ${u.department_name || 'N/A'})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Or Department</label>
                <select class="form-control" id="assign-dept-select">
                    <option value="">— Select Department —</option>
                    ${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <input type="text" class="form-control" id="assign-notes" placeholder="Optional note">
            </div>`;

        const footer = `<button class="btn btn-outline" onclick="App.utils.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="App.views['asset-list'].doAssign(${assetId})">Assign</button>`;

        App.utils.showModal('Assign Asset', body, footer);
    },

    async doAssign(assetId) {
        const userId = document.getElementById('assign-user-select').value;
        const deptId = document.getElementById('assign-dept-select').value;
        const notes = document.getElementById('assign-notes').value;

        if (!userId && !deptId) { App.utils.toast('Select an employee or department', 'warning'); return; }

        try {
            await App.api.post(`/assets/${assetId}/assign`, { assigned_to_user: userId || null, assigned_to_dept: deptId || null, notes });
            App.utils.closeModal();
            App.utils.toast('Asset assigned successfully!', 'success');
            this.loadAssets();
        } catch(e) {}
    }
};
