/* ════════════════════════════════════════════════════════
   VIEW — Asset Categories
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['asset-categories'] = {
    title: 'Asset Categories',

    render() {
        return `
        <div class="page-header">
            <h1>Asset Categories</h1>
            <button class="btn btn-primary" onclick="App.views['asset-categories'].showAddModal()">+ Add Category</button>
        </div>
        <div class="card" style="padding:0">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Name</th><th>Description</th><th>Assets</th><th>Actions</th></tr></thead>
                    <tbody id="cat-table-body"><tr><td colspan="4"><div class="spinner"></div></td></tr></tbody>
                </table>
            </div>
        </div>`;
    },

    async afterRender() { this.loadCategories(); },

    async loadCategories() {
        try {
            const { categories } = await App.api.get('/assets/categories');
            const tbody = document.getElementById('cat-table-body');
            if (categories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-text">No categories yet</div></div></td></tr>';
            } else {
                tbody.innerHTML = categories.map(c => `
                    <tr>
                        <td style="font-weight:600">${App.utils.escapeHtml(c.name)}</td>
                        <td style="color:var(--text-secondary)">${App.utils.escapeHtml(c.description || '—')}</td>
                        <td><span class="badge badge-primary">${c.asset_count}</span></td>
                        <td>
                            <div class="table-actions">
                                <button class="btn btn-ghost btn-sm" onclick="App.views['asset-categories'].showEditModal(${c.id}, '${App.utils.escapeHtml(c.name)}', '${App.utils.escapeHtml(c.description || '')}')">Edit</button>
                                <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="App.views['asset-categories'].deleteCategory(${c.id}, '${App.utils.escapeHtml(c.name)}', ${c.asset_count})">Delete</button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        } catch(e) {}
    },

    showAddModal() {
        const body = `
            <div class="form-group"><label class="form-label">Category Name *</label><input type="text" class="form-control" id="cat-name" required></div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" id="cat-desc" rows="3"></textarea></div>`;
        const footer = `<button class="btn btn-outline" onclick="App.utils.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="App.views['asset-categories'].createCategory()">Create</button>`;
        App.utils.showModal('Add Category', body, footer);
    },

    showEditModal(id, name, desc) {
        const body = `
            <div class="form-group"><label class="form-label">Category Name *</label><input type="text" class="form-control" id="cat-name" value="${name}"></div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" id="cat-desc" rows="3">${desc}</textarea></div>`;
        const footer = `<button class="btn btn-outline" onclick="App.utils.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="App.views['asset-categories'].updateCategory(${id})">Update</button>`;
        App.utils.showModal('Edit Category', body, footer);
    },

    async createCategory() {
        const name = document.getElementById('cat-name').value.trim();
        if (!name) { App.utils.toast('Name is required', 'warning'); return; }
        try {
            await App.api.post('/assets/categories', { name, description: document.getElementById('cat-desc').value });
            App.utils.closeModal(); App.utils.toast('Category created!', 'success'); this.loadCategories();
        } catch(e) {}
    },

    async updateCategory(id) {
        try {
            await App.api.put(`/assets/categories/${id}`, { name: document.getElementById('cat-name').value, description: document.getElementById('cat-desc').value });
            App.utils.closeModal(); App.utils.toast('Category updated!', 'success'); this.loadCategories();
        } catch(e) {}
    },

    async deleteCategory(id, name, count) {
        if (count > 0) { App.utils.toast(`Cannot delete: ${count} assets use "${name}"`, 'error'); return; }
        if (!App.utils.confirm(`Delete category "${name}"?`)) return;
        try { await App.api.del(`/assets/categories/${id}`); App.utils.toast('Deleted', 'success'); this.loadCategories(); } catch(e) {}
    }
};
