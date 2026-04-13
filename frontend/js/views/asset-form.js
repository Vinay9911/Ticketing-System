/* ════════════════════════════════════════════════════════
   VIEW — Asset Form (Create / Edit)
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['asset-form'] = {
    title: 'Add Asset',

    render(params) {
        const isEdit = params && params.id;
        return `
        <div style="margin-bottom:16px"><a href="#/assets" style="color:var(--primary);font-weight:500">← Back to Assets</a></div>
        <div class="page-header"><h1>${isEdit ? 'Edit Asset' : 'Add New Asset'}</h1></div>
        <div class="card" style="max-width:720px">
            <form id="asset-form">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Asset Name *</label><input type="text" class="form-control" id="af-name" required placeholder="e.g., Dell XPS 15 Laptop"></div>
                    <div class="form-group"><label class="form-label">Category</label><select class="form-control" id="af-category"><option value="">Select Category</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Serial Number</label><input type="text" class="form-control" id="af-serial" placeholder="e.g., SN-DELL-001"></div>
                    <div class="form-group"><label class="form-label">Location</label><input type="text" class="form-control" id="af-location" placeholder="e.g., Floor 2, Desk 12"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Purchase Date</label><input type="date" class="form-control" id="af-purchase-date"></div>
                    <div class="form-group"><label class="form-label">Cost (₹)</label><input type="number" class="form-control" id="af-cost" step="0.01" placeholder="0.00"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Warranty Expiry</label><input type="date" class="form-control" id="af-warranty"></div>
                    <div class="form-group"><label class="form-label">Status</label>
                        <select class="form-control" id="af-status">
                            <option value="available">Available</option>
                            <option value="in_use">In Use</option>
                            <option value="under_maintenance">Under Maintenance</option>
                            <option value="retired">Retired</option>
                        </select>
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Notes</label><textarea class="form-control" id="af-notes" placeholder="Additional information..."></textarea></div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update Asset' : 'Create Asset'}</button>
                    <a href="#/assets" class="btn btn-outline">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    async afterRender(params) {
        // Load categories
        try {
            const { categories } = await App.api.get('/assets/categories');
            const sel = document.getElementById('af-category');
            categories.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
        } catch(e) {}

        // If editing, pre-populate
        if (params && params.id) {
            try {
                const { asset } = await App.api.get(`/assets/${params.id}`);
                document.getElementById('af-name').value = asset.name || '';
                document.getElementById('af-category').value = asset.category_id || '';
                document.getElementById('af-serial').value = asset.serial_number || '';
                document.getElementById('af-location').value = asset.location || '';
                document.getElementById('af-purchase-date').value = asset.purchase_date || '';
                document.getElementById('af-cost').value = asset.cost || '';
                document.getElementById('af-warranty').value = asset.warranty_expiry || '';
                document.getElementById('af-status').value = asset.status || 'available';
                document.getElementById('af-notes').value = asset.notes || '';
            } catch(e) {}
        }

        document.getElementById('asset-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById('af-name').value,
                category_id: document.getElementById('af-category').value || null,
                serial_number: document.getElementById('af-serial').value || null,
                location: document.getElementById('af-location').value || null,
                purchase_date: document.getElementById('af-purchase-date').value || null,
                cost: document.getElementById('af-cost').value || null,
                warranty_expiry: document.getElementById('af-warranty').value || null,
                status: document.getElementById('af-status').value,
                notes: document.getElementById('af-notes').value || null
            };

            try {
                if (params && params.id) {
                    await App.api.put(`/assets/${params.id}`, payload);
                    App.utils.toast('Asset updated!', 'success');
                } else {
                    await App.api.post('/assets', payload);
                    App.utils.toast('Asset created!', 'success');
                }
                window.location.hash = '#/assets';
            } catch(e) {}
        });
    }
};
