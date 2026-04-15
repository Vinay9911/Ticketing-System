/* ════════════════════════════════════════════════════════
   VIEW — Asset Detail
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['asset-detail'] = {
    title: 'Asset Details',

    render(params) {
        return `
        <div style="margin-bottom:16px"><a href="#/assets" style="color:var(--primary);font-weight:500">← Back to Assets</a></div>
        <div id="asset-detail-content"><div class="spinner"></div></div>`;
    },

    async afterRender(params) {
        try {
            const { asset } = await App.api.get(`/assets/${params.id}`);
            const { history } = await App.api.get(`/assets/${params.id}/history`);
            const isAdmin = App.auth.hasRole('admin');
            const isManager = App.auth.hasRole('admin', 'manager');

            document.getElementById('asset-detail-content').innerHTML = `
                <div class="page-header">
                    <div>
                        <h1>${App.utils.escapeHtml(asset.name)}</h1>
                        <p style="margin-top:4px;font-size:0.88rem">${asset.serial_number || 'No serial number'} ${asset.category_name ? '• ' + asset.category_name : ''}</p>
                    </div>
                    <div class="page-header-actions">
                        ${App.utils.statusBadge(asset.status)}
                        ${isAdmin ? `<a href="#/assets/${asset.id}/edit" class="btn btn-outline btn-sm">Edit</a>` : ''}
                        ${isAdmin && asset.status !== 'retired' ? `<button class="btn btn-danger btn-sm" onclick="App.views['asset-detail'].deleteAsset(${asset.id})">Delete</button>` : ''}
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px">
                    <!-- Info Card -->
                    <div class="card" style="grid-column: 1 / -1;">
                        <div class="card-header"><span class="card-title">Asset Specifications & Registration</span></div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;font-size:0.88rem">
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">SL_NO</span><strong style="font-family:var(--font-mono)">${asset.id} / ${asset.name}</strong></div>
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">Device_Serial_No</span><strong>${asset.serial_number || '—'}</strong></div>
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">ExpressServiceCodeORProduct</span><strong>${asset.express_service_code || '—'}</strong></div>
                            
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">MAKE_MODEL</span><strong>${asset.make_model || '—'}</strong></div>
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">DEVICE TYPE</span><strong>${asset.category_name || '—'}</strong></div>
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">Location</span><strong>${asset.location || '—'}</strong></div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;font-size:0.88rem;margin-top:16px;padding-top:16px;border-top:1px solid var(--border-light)">
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">warrantystartdate</span><strong>${App.utils.formatDate(asset.warranty_start_date) || '—'}</strong></div>
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">warrantyenddate</span><strong>${App.utils.formatDate(asset.warranty_expiry) || '—'}</strong></div>
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">PurchasedDate</span><strong>${App.utils.formatDate(asset.purchase_date) || '—'} (₹${asset.cost || 0})</strong></div>
                            
                            <div><span style="color:var(--text-muted);font-size:0.78rem;display:block">STATUS</span><strong>${asset.status}</strong></div>
                            <div style="grid-column: span 2"><span style="color:var(--text-muted);font-size:0.78rem;display:block">REMARK</span><strong>${App.utils.escapeHtml(asset.notes) || '—'}</strong></div>
                        </div>
                    </div>

                    <!-- Assignment Card -->
                    <div class="card" style="grid-column: 1 / -1;">
                        <div class="card-header">
                            <span class="card-title">Assignment Information</span>
                            ${isManager && asset.status !== 'retired' ? `
                                ${asset.assigned_to_user || asset.assigned_to_dept
                                    ? `<button class="btn btn-outline btn-sm" onclick="App.views['asset-detail'].unassign(${asset.id})">Unassign</button>`
                                    : `<button class="btn btn-primary btn-sm" onclick="App.views['asset-list'].showAssign(${asset.id}, '${App.utils.escapeHtml(asset.name)}')">Assign</button>`
                                }
                            ` : ''}
                        </div>
                        ${asset.assigned_user_name || asset.dept_name ? `
                            <div style="display:flex;gap:10px;padding:16px;background:var(--primary-bg);border-radius:var(--radius-md)">
                                <div style="flex:1"><span style="color:var(--text-muted);font-size:0.78rem;display:block">EMP_NAME</span><strong>${asset.assigned_user_name || '—'}</strong></div>
                                <div style="flex:1"><span style="color:var(--text-muted);font-size:0.78rem;display:block">EMP_ID</span><strong>${asset.assigned_user_emp_id || '—'}</strong></div>
                                <div style="flex:1"><span style="color:var(--text-muted);font-size:0.78rem;display:block">Department</span><strong>${asset.dept_name || '—'}</strong></div>
                            </div>
                        ` : `<div class="empty-state" style="padding:24px"><div class="empty-state-text">Not Assigned (EMP_NAME: —, EMP_ID: —, Department: —)</div></div>`}
                    </div>
                </div>

                <!-- History Timeline -->
                <div class="card">
                    <div class="card-header"><span class="card-title">Asset History</span></div>
                    ${history.length === 0 ? '<div class="empty-state"><div class="empty-state-text">No history recorded</div></div>' : `
                        <div class="timeline">
                            ${history.map(h => `
                                <div class="timeline-item">
                                    <div class="timeline-date">${App.utils.formatDateTime(h.created_at)}</div>
                                    <div class="timeline-content">
                                        <strong>${h.performed_by_name || 'System'}</strong>
                                        <span style="color:var(--text-secondary)"> — ${h.action_type.replace('_', ' ')}</span>
                                        ${h.notes ? `<div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px">${App.utils.escapeHtml(h.notes)}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>`;
        } catch(e) {
            document.getElementById('asset-detail-content').innerHTML = '<div class="empty-state"><div class="empty-state-text">Asset not found</div></div>';
        }
    },

    async deleteAsset(id) {
        if (!App.utils.confirm('Are you sure you want to delete this asset?')) return;
        try {
            await App.api.del(`/assets/${id}`);
            App.utils.toast('Asset deleted', 'success');
            window.location.hash = '#/assets';
        } catch(e) {}
    },

    async unassign(id) {
        if (!App.utils.confirm('Unassign this asset?')) return;
        try {
            await App.api.post(`/assets/${id}/unassign`, {});
            App.utils.toast('Asset unassigned', 'success');
            App.router.resolve();
        } catch(e) {}
    }
};
