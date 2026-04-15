/* ════════════════════════════════════════════════════════
   VIEW — Create / Edit Ticket
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['ticket-form'] = {
    title: 'Create Ticket',

    render() {
        // Pre-fill user data conceptually
        const user = App.state.getUser() || {};
        const isEditing = false; // We can expand to edit later if needed

        return `
        <div style="margin-bottom:16px"><a href="#/tickets" style="color:var(--primary);font-weight:500">← Back to Tickets</a></div>
        <div class="page-header"><h1>New Ticket</h1></div>
        <div class="card" style="max-width:800px">
            <form id="ticket-form">
                <h4 style="margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">User Information</h4>
                <div class="form-row" style="margin-bottom:20px;">
                    <div class="form-group">
                        <label class="form-label">User Name</label>
                        <input type="text" class="form-control" value="${user.name || ''}" readonly style="background:var(--bg-hover)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Emp ID</label>
                        <input type="text" class="form-control" value="${user.emp_id || ''}" readonly style="background:var(--bg-hover)">
                    </div>
                </div>
                <div class="form-row" style="margin-bottom:30px;">
                    <div class="form-group">
                        <label class="form-label">Department</label>
                        <input type="text" class="form-control" value="${user.departmentName || ''}" readonly style="background:var(--bg-hover)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email ID</label>
                        <input type="text" class="form-control" value="${user.email || ''}" readonly style="background:var(--bg-hover)">
                    </div>
                </div>

                <h4 style="margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);">Issue Details</h4>
                <div class="form-row">
                    <div class="form-group" style="flex:2">
                        <label class="form-label">Issue Title *</label>
                        <input type="text" class="form-control" id="tf-title" required placeholder="Brief summary of the issue">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label class="form-label">Priority *</label>
                        <select class="form-control" id="tf-priority" required>
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Related Asset (optional)</label>
                    <select class="form-control" id="tf-asset">
                        <option value="">— None —</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Issue Description *</label>
                    <textarea class="form-control" id="tf-description" required rows="5" placeholder="Describe the issue in detail..."></textarea>
                </div>
                
                <div class="form-row" style="margin-bottom:20px;">
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <input type="text" class="form-control" value="Open" readonly style="background:var(--bg-hover)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ticket Created Date</label>
                        <input type="text" class="form-control" value="Will be generated upon submit" readonly style="background:var(--bg-hover)">
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Submit Ticket</button>
                    <a href="#/tickets" class="btn btn-outline">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    async afterRender() {
        try {
            const { assets } = await App.api.get('/assets?limit=100');
            const sel = document.getElementById('tf-asset');
            assets.forEach(a => {
                const o = document.createElement('option');
                o.value = a.id; o.textContent = `${a.name} (${a.serial_number || 'No SN'})`;
                sel.appendChild(o);
            });
        } catch(e) {}

        document.getElementById('ticket-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                title: document.getElementById('tf-title').value,
                issue_type: 'other', // Defaulting since we removed the dropdown to match user explicitly
                priority: document.getElementById('tf-priority').value,
                asset_id: document.getElementById('tf-asset').value || null,
                description: document.getElementById('tf-description').value
            };
            try {
                const result = await App.api.post('/tickets', payload);
                App.utils.toast(\`Ticket \${result.ticket_number} created!\`, 'success');
                window.location.hash = '#/tickets';
            } catch(e) {}
        });
    }
};
