/* ════════════════════════════════════════════════════════
   VIEW — Create Ticket
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['ticket-form'] = {
    title: 'Create Ticket',

    render() {
        return `
        <div style="margin-bottom:16px"><a href="#/tickets" style="color:var(--primary);font-weight:500">← Back to Tickets</a></div>
        <div class="page-header"><h1>Create New Ticket</h1></div>
        <div class="card" style="max-width:720px">
            <form id="ticket-form">
                <div class="form-group">
                    <label class="form-label">Title *</label>
                    <input type="text" class="form-control" id="tf-title" required placeholder="Brief summary of the issue">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Issue Type *</label>
                        <select class="form-control" id="tf-issue-type" required>
                            <option value="hardware_fault">Hardware Fault</option>
                            <option value="software">Software Issue</option>
                            <option value="access">Access / Permissions</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
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
                    <label class="form-label">Description *</label>
                    <textarea class="form-control" id="tf-description" required rows="5" placeholder="Describe the issue in detail. Include any error messages, steps to reproduce, etc."></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Submit Ticket</button>
                    <a href="#/tickets" class="btn btn-outline">Cancel</a>
                </div>
            </form>
        </div>`;
    },

    async afterRender() {
        // Load assets for dropdown
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
                issue_type: document.getElementById('tf-issue-type').value,
                priority: document.getElementById('tf-priority').value,
                asset_id: document.getElementById('tf-asset').value || null,
                description: document.getElementById('tf-description').value
            };
            try {
                const result = await App.api.post('/tickets', payload);
                App.utils.toast(`Ticket ${result.ticket_number} created!`, 'success');
                window.location.hash = '#/tickets';
            } catch(e) {}
        });
    }
};
