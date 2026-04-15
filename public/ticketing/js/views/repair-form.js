/* ════════════════════════════════════════════════════════
   VIEW — Repair Form
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['repair-form'] = {
    title: 'Schedule Repair',

    render(params) {
        const isEdit = params && params.id;
        return `
        <div style="margin-bottom:16px"><a href="#/repairs" style="color:var(--primary);font-weight:500">← Back to Repairs</a></div>
        <div class="page-header"><h1>${isEdit ? 'Edit Repair' : 'Schedule New Repair'}</h1></div>
        <div class="card" style="max-width:800px">
            <form id="repair-form">

                <h4 style="margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">Asset Details</h4>
                <div class="form-row" style="align-items:flex-end">
                    <div class="form-group" style="flex:2">
                        <label class="form-label">Search by Laptop/Asset Serial Number</label>
                        <div style="display:flex;gap:10px">
                            <input type="text" class="form-control" id="rf-serial-search" placeholder="Enter exact serial number">
                            <button type="button" class="btn btn-outline" id="btn-autofill">Auto-fill</button>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Asset Name</label>
                        <input type="text" class="form-control" id="rf-asset-name" readonly style="background:var(--bg-hover)">
                        <input type="hidden" id="rf-asset-id" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Make / Model</label>
                        <input type="text" class="form-control" id="rf-asset-make" readonly style="background:var(--bg-hover)">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Warranty Expiry Date</label>
                        <input type="text" class="form-control" id="rf-asset-warranty" readonly style="background:var(--bg-hover)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Current Status</label>
                        <input type="text" class="form-control" id="rf-asset-status" readonly style="background:var(--bg-hover)">
                    </div>
                </div>

                <h4 style="margin-top:10px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">Repair Details</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Repair Date *</label>
                        <input type="date" class="form-control" id="rf-date" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Service Provider</label>
                        <input type="text" class="form-control" id="rf-provider" placeholder="e.g., Dell Auth Center">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Estimated Cost (₹)</label>
                        <input type="number" class="form-control" id="rf-cost" step="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Repair Status</label>
                        <select class="form-control" id="rf-status">
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Issue Details / Notes *</label>
                    <textarea class="form-control" id="rf-description" rows="3" required placeholder="Describe the hardware or software issue..."></textarea>
                </div>

                <h4 style="margin-top:10px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">Billing & Approval</h4>
                <div class="form-row" style="align-items:center">
                    <div class="form-group" style="flex:1">
                        <label class="form-label">Upload Invoice (PDF/Image)</label>
                        <input type="file" class="form-control" id="rf-invoice" accept=".pdf,.png,.jpg,.jpeg">
                    </div>
                    <div class="form-group" style="flex:1; padding-top:28px">
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                            <input type="checkbox" id="rf-approval" style="width:18px;height:18px">
                            <span style="font-weight:500">Requires Out-of-Band Approval (Email)</span>
                        </label>
                    </div>
                </div>
                
                <div class="form-actions" style="margin-top:20px">
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update Repair' : 'Log Repair'}</button>
                    <a href="#/repairs" class="btn btn-outline">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    async afterRender(params) {
        // Auto-fill logic
        document.getElementById('btn-autofill').addEventListener('click', async () => {
            const serial = document.getElementById('rf-serial-search').value.trim();
            if (!serial) {
                App.utils.toast('Please enter a serial number', 'warning');
                return;
            }
            try {
                // Fetch first asset matching exactly the serial number
                const { assets } = await App.api.get(`/assets?search=${encodeURIComponent(serial)}`);
                const asset = assets.find(a => a.serial_number && a.serial_number.toLowerCase() === serial.toLowerCase());
                
                if (!asset) {
                    App.utils.toast('No asset found with that serial number', 'error');
                    return;
                }

                // Populate logic
                document.getElementById('rf-asset-id').value = asset.id;
                document.getElementById('rf-asset-name').value = asset.name || '';
                document.getElementById('rf-asset-make').value = asset.make_model || '—';
                document.getElementById('rf-asset-warranty').value = asset.warranty_expiry ? App.utils.formatDate(asset.warranty_expiry) : '—';
                document.getElementById('rf-asset-status').value = asset.status || '—';

                App.utils.toast('Asset details auto-filled', 'success');
            } catch(e) {}
        });

        // Edit mode data population
        if (params && params.id) {
            try {
                const { repair } = await App.api.get(`/repairs/${params.id}`);
                document.getElementById('rf-asset-id').value = repair.asset_id;
                document.getElementById('rf-asset-name').value = repair.asset_name || '';
                document.getElementById('rf-date').value = repair.repair_date ? repair.repair_date.split('T')[0] : '';
                document.getElementById('rf-status').value = repair.status || 'scheduled';
                document.getElementById('rf-description').value = repair.description || '';
                document.getElementById('rf-cost').value = repair.estimated_cost || '';
                document.getElementById('rf-provider').value = repair.provider || '';
                if(repair.requires_approval) document.getElementById('rf-approval').checked = true;

                // Disable some fields logically when editing
                document.getElementById('btn-autofill').disabled = true;
                document.getElementById('rf-serial-search').disabled = true;
                document.getElementById('rf-approval').disabled = true; // Usually fixed at creation for demo
            } catch(e) {}
        }

        // Form Submit Logic for File Uploads
        document.getElementById('repair-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const assetId = document.getElementById('rf-asset-id').value;
            if (!assetId) {
                App.utils.toast('Please auto-fill an asset first', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('asset_id', assetId);
            formData.append('repair_date', document.getElementById('rf-date').value);
            formData.append('description', document.getElementById('rf-description').value);
            formData.append('estimated_cost', document.getElementById('rf-cost').value);
            formData.append('status', document.getElementById('rf-status').value);
            formData.append('provider', document.getElementById('rf-provider').value);
            formData.append('requires_approval', document.getElementById('rf-approval').checked);

            const fileInput = document.getElementById('rf-invoice');
            if (fileInput.files.length > 0) {
                formData.append('invoice', fileInput.files[0]);
            }

            try {
                if (params && params.id) {
                    await App.api.putFormData(`/repairs/${params.id}`, formData);
                    App.utils.toast('Repair updated successfully!', 'success');
                } else {
                    await App.api.postFormData('/repairs', formData);
                    const requiresApproval = document.getElementById('rf-approval').checked;
                    if (requiresApproval) {
                        App.utils.toast('Repair scheduled. Approval email sent!', 'info');
                    } else {
                        App.utils.toast('Repair scheduled successfully!', 'success');
                    }
                }
                window.location.hash = '#/repairs';
            } catch(error) {}
        });
    }
};
