/* ════════════════════════════════════════════════════════
   VIEW — Schedule Maintenance
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['maintenance-form'] = {
    title: 'Schedule Maintenance',

    render() {
        return `
        <div style="margin-bottom:16px"><a href="#/maintenance" style="color:var(--primary);font-weight:500">← Back to Maintenance</a></div>
        <div class="page-header"><h1>Schedule Maintenance</h1></div>
        <div class="card" style="max-width:600px">
            <form id="maint-form">
                <div class="form-group">
                    <label class="form-label">Asset *</label>
                    <select class="form-control" id="mf-asset" required><option value="">Select Asset</option></select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Maintenance Type</label>
                        <select class="form-control" id="mf-type">
                            <option value="Preventive">Preventive</option>
                            <option value="Repair">Repair</option>
                            <option value="Inspection">Inspection</option>
                            <option value="Cleaning">Cleaning</option>
                            <option value="Upgrade">Upgrade</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Scheduled Date *</label>
                        <input type="date" class="form-control" id="mf-date" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Assign Technician</label>
                    <select class="form-control" id="mf-technician"><option value="">Select Technician (optional)</option></select>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea class="form-control" id="mf-notes" rows="3" placeholder="Details about the maintenance..."></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Schedule</button>
                    <a href="#/maintenance" class="btn btn-outline">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    async afterRender() {
        // Load assets
        try {
            const { assets } = await App.api.get('/assets?limit=100&status=available');
            const allAssets = await App.api.get('/assets?limit=100');
            const sel = document.getElementById('mf-asset');
            (allAssets.assets || []).forEach(a => {
                if (a.status !== 'retired') {
                    const o = document.createElement('option');
                    o.value = a.id; o.textContent = `${a.name} (${a.serial_number || 'No SN'}) — ${a.status}`;
                    sel.appendChild(o);
                }
            });
        } catch(e) {}

        // Load users for technician
        try {
            const { users } = await App.api.get('/users?role=staff');
            const sel = document.getElementById('mf-technician');
            users.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = `${u.name} (${u.department_name || ''})`; sel.appendChild(o); });
        } catch(e) {}

        // Set min date to today
        document.getElementById('mf-date').min = new Date().toISOString().split('T')[0];

        document.getElementById('maint-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await App.api.post('/maintenance', {
                    asset_id: parseInt(document.getElementById('mf-asset').value),
                    scheduled_date: document.getElementById('mf-date').value,
                    maintenance_type: document.getElementById('mf-type').value,
                    assigned_to: document.getElementById('mf-technician').value || null,
                    notes: document.getElementById('mf-notes').value
                });
                App.utils.toast('Maintenance scheduled!', 'success');
                window.location.hash = '#/maintenance';
            } catch(e) {}
        });
    }
};
