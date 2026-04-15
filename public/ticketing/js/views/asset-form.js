/* ════════════════════════════════════════════════════════
   VIEW — Asset Form (Create / Edit)
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['asset-form'] = {
    title: 'Asset Form',

    render(params) {
        const isEdit = params && params.id;
        return `
        <div style="margin-bottom:16px"><a href="#/assets" style="color:var(--primary);font-weight:500">← Back to Assets</a></div>
        <div class="page-header"><h1>${isEdit ? 'Edit Asset' : 'Add New Asset'}</h1></div>
        <div class="card" style="max-width:800px">
            <form id="asset-form">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">SL_NO (ID) *</label>
                        <input type="text" class="form-control" id="af-name" required placeholder="Name or Identifier">
                    </div>
                </div>

                <h4 style="margin-top:10px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">Hardware Specifications</h4>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Device_Serial_No</label><input type="text" class="form-control" id="af-serial" placeholder="e.g., SN-DELL-001"></div>
                    <div class="form-group"><label class="form-label">ExpressServiceCodeORProduct</label><input type="text" class="form-control" id="af-express" placeholder="e.g., 123456789"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">MAKE_MODEL</label><input type="text" class="form-control" id="af-makemodel" placeholder="e.g., Dell Latitude 7420"></div>
                    <div class="form-group"><label class="form-label">DEVICE TYPE</label><select class="form-control" id="af-category"><option value="">Select Category</option></select></div>
                </div>

                <h4 style="margin-top:10px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">Assignment & Location</h4>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Location</label><input type="text" class="form-control" id="af-location" placeholder="e.g., Floor 2, Desk 12"></div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex:2">
                        <label class="form-label">EMP_NAME (Assignee)</label>
                        <select class="form-control" id="af-user"><option value="">Unassigned</option></select>
                    </div>
                    <!-- EMP_ID and Department will just be view-only based on Selected EMP_NAME in real scenario, but we can leave them disabled -->
                    <div class="form-group" style="flex:1"><label class="form-label">EMP_ID</label><input type="text" class="form-control" id="af-empid" readonly style="background:var(--bg-hover)"></div>
                    <div class="form-group" style="flex:1"><label class="form-label">Department</label><input type="text" class="form-control" id="af-dept" readonly style="background:var(--bg-hover)"></div>
                </div>

                <h4 style="margin-top:10px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">Lifecycle & Warranty</h4>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">warrantystartdate</label><input type="date" class="form-control" id="af-warrantystart"></div>
                    <div class="form-group"><label class="form-label">warrantyenddate</label><input type="date" class="form-control" id="af-warrantyend"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">PurchasedDate</label><input type="date" class="form-control" id="af-purchase-date"></div>
                    <div class="form-group"><label class="form-label">STATUS</label>
                        <select class="form-control" id="af-status">
                            <option value="available">Available</option>
                            <option value="in_use">In Use</option>
                            <option value="under_maintenance">Under Maintenance</option>
                            <option value="retired">Retired</option>
                        </select>
                    </div>
                </div>

                <div class="form-group"><label class="form-label">REMARK</label><textarea class="form-control" id="af-notes" placeholder="Additional information..."></textarea></div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update Asset' : 'Create Asset'}</button>
                    <a href="#/assets" class="btn btn-outline">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    async afterRender(params) {
        // Load categories and users
        let usersData = [];
        try {
            const [{ categories }, { users }] = await Promise.all([
                App.api.get('/assets/categories'),
                App.api.get('/users')
            ]);
            usersData = users;
            const catSel = document.getElementById('af-category');
            categories.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; catSel.appendChild(o); });

            const userSel = document.getElementById('af-user');
            users.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = u.name; userSel.appendChild(o); });

            userSel.addEventListener('change', (e) => {
                const u = usersData.find(x => x.id == e.target.value);
                if (u) {
                    document.getElementById('af-empid').value = u.emp_id || '';
                    document.getElementById('af-dept').value = u.department_name || '';
                } else {
                    document.getElementById('af-empid').value = '';
                    document.getElementById('af-dept').value = '';
                }
            });

        } catch(e) {}

        // If editing, pre-populate
        if (params && params.id) {
            try {
                const { asset } = await App.api.get(`/assets/${params.id}`);
                document.getElementById('af-name').value = asset.name || '';
                document.getElementById('af-category').value = asset.category_id || '';
                document.getElementById('af-serial').value = asset.serial_number || '';
                document.getElementById('af-express').value = asset.express_service_code || '';
                document.getElementById('af-makemodel').value = asset.make_model || '';
                document.getElementById('af-location').value = asset.location || '';
                
                document.getElementById('af-warrantystart').value = asset.warranty_start_date ? asset.warranty_start_date.split('T')[0] : '';
                document.getElementById('af-warrantyend').value = asset.warranty_expiry ? asset.warranty_expiry.split('T')[0] : '';
                document.getElementById('af-purchase-date').value = asset.purchase_date ? asset.purchase_date.split('T')[0] : '';
                document.getElementById('af-status').value = asset.status || 'available';
                document.getElementById('af-notes').value = asset.notes || '';

                if (asset.assigned_to_user) {
                    const sel = document.getElementById('af-user');
                    sel.value = asset.assigned_to_user;
                    sel.dispatchEvent(new Event('change'));
                }
            } catch(e) {}
        }

        document.getElementById('asset-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById('af-name').value, // This represents SL_NO conceptually 
                category_id: document.getElementById('af-category').value || null,
                serial_number: document.getElementById('af-serial').value || null,
                express_service_code: document.getElementById('af-express').value || null,
                make_model: document.getElementById('af-makemodel').value || null,
                location: document.getElementById('af-location').value || null,
                purchase_date: document.getElementById('af-purchase-date').value || null,
                warranty_start_date: document.getElementById('af-warrantystart').value || null,
                warranty_expiry: document.getElementById('af-warrantyend').value || null,
                status: document.getElementById('af-status').value,
                notes: document.getElementById('af-notes').value || null
            };

            const userAssign = document.getElementById('af-user').value;

            try {
                if (params && params.id) {
                    await App.api.put(`/assets/${params.id}`, payload);
                    if (userAssign) await App.api.post(`/assets/${params.id}/assign`, { assigned_to_user: userAssign });
                    App.utils.toast('Asset updated!', 'success');
                } else {
                    const created = await App.api.post('/assets', payload);
                    if (userAssign) await App.api.post(`/assets/${created.id}/assign`, { assigned_to_user: userAssign });
                    App.utils.toast('Asset created!', 'success');
                }
                window.location.hash = '#/assets';
            } catch(e) {}
        });
    }
};
