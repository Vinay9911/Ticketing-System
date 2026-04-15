/* ════════════════════════════════════════════════════════
   VIEW — Ticket Detail
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['ticket-detail'] = {
    title: 'Ticket Details',

    render() {
        return `<div style="margin-bottom:16px"><a href="#/tickets" style="color:var(--primary);font-weight:500">← Back to Tickets</a></div>
        <div id="ticket-detail-content"><div class="spinner"></div></div>`;
    },

    async afterRender(params) {
        try {
            const { ticket, comments } = await App.api.get(`/tickets/${params.id}`);
            const user = App.state.getUser();
            const isAdminOrManager = App.auth.hasRole('admin', 'manager');
            const canUpdate = isAdminOrManager || ticket.raised_by === user.id || ticket.assigned_to === user.id;

            document.getElementById('ticket-detail-content').innerHTML = `
                <div class="page-header">
                    <div>
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
                            <span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--text-muted)">${ticket.ticket_number}</span>
                            ${App.utils.priorityBadge(ticket.priority)}
                            ${App.utils.statusBadge(ticket.status)}
                        </div>
                        <h1 style="font-size:1.4rem">${App.utils.escapeHtml(ticket.title)}</h1>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px;margin-bottom:20px">
                    <!-- Basic Fields Grid -->
                    <div class="card" style="grid-column: 1 / -1; margin-bottom: 0;">
                        <div class="card-header"><span class="card-title">Ticket Information</span></div>
                        <div class="form-row">
                            <div class="form-group"><label class="form-label">User Name</label><div style="font-weight:600">${ticket.raised_by_name}</div></div>
                            <div class="form-group"><label class="form-label">Emp ID</label><div>${ticket.raised_by_emp_id || '—'}</div></div>
                            <div class="form-group"><label class="form-label">Dept</label><div>${ticket.raised_by_dept || '—'}</div></div>
                            <div class="form-group"><label class="form-label">Email ID</label><div>${ticket.raised_by_email || '—'}</div></div>
                        </div>
                        <div class="form-row" style="margin-top:12px; border-top:1px solid var(--border-light); padding-top:16px">
                            <div class="form-group"><label class="form-label">Priority</label><div>${App.utils.priorityBadge(ticket.priority)}</div></div>
                            <div class="form-group"><label class="form-label">Status</label><div>${App.utils.statusBadge(ticket.status)}</div></div>
                            <div class="form-group"><label class="form-label">Ticket Created Date</label><div>${App.utils.formatDateTime(ticket.created_at)}</div></div>
                            <div class="form-group"><label class="form-label">Issue Title</label><div style="font-weight:600">${App.utils.escapeHtml(ticket.title)}</div></div>
                        </div>
                        ${ticket.asset_name ? `<div style="margin-top:12px; border-top:1px solid var(--border-light); padding-top:16px"><span style="color:var(--text-muted);font-size:0.78rem;display:block">Related Asset</span><a href="#/assets/${ticket.asset_id}" style="font-weight:600">${ticket.asset_name}</a> <span style="font-size:0.82rem;color:var(--text-secondary)">${ticket.asset_serial || ''}</span></div>` : ''}
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px">
                    <!-- Main Info -->
                    <div>
                        <div class="card">
                            <div class="card-header"><span class="card-title">Issue Description</span></div>
                            <div style="white-space:pre-wrap;font-size:0.9rem;color:var(--text-secondary);line-height:1.7">${App.utils.escapeHtml(ticket.description)}</div>
                        </div>

                        <!-- Comments -->
                        <div class="card">
                            <div class="card-header"><span class="card-title">Comments (${comments.length})</span></div>
                            ${comments.length === 0 ? '<p style="color:var(--text-muted);font-size:0.88rem">No comments yet</p>' :
                                comments.map(c => `
                                    <div class="comment ${c.is_internal ? 'internal' : ''}">
                                        ${App.utils.avatar(c.user_name, c.user_role)}
                                        <div class="comment-body">
                                            <div class="comment-header">
                                                <span class="comment-author">${c.user_name}</span>
                                                ${App.utils.roleBadge(c.user_role)}
                                                <span class="comment-time">${App.utils.timeAgo(c.created_at)}</span>
                                            </div>
                                            <div class="comment-text">${App.utils.escapeHtml(c.comment)}</div>
                                        </div>
                                    </div>
                                `).join('')
                            }
                            <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-light)">
                                <textarea class="form-control" id="new-comment" placeholder="Add a comment..." rows="3"></textarea>
                                <div style="display:flex;gap:10px;margin-top:10px;align-items:center">
                                    ${isAdminOrManager ? '<label style="font-size:0.82rem;color:var(--text-secondary);display:flex;align-items:center;gap:6px"><input type="checkbox" id="comment-internal"> Internal note</label>' : ''}
                                    <button class="btn btn-primary btn-sm" onclick="App.views['ticket-detail'].addComment(${ticket.id})" style="margin-left:auto">Post Comment</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar Info -->
                    <div>
                        <!-- Status / Actions -->
                        ${canUpdate ? `
                        <div class="card">
                            <div class="card-header"><span class="card-title">Update Status</span></div>
                            <div style="display:flex;gap:10px">
                                <select class="form-control" id="status-select" style="flex:1">
                                    <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Open</option>
                                    <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                                    ${isAdminOrManager ? `<option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Closed</option>` : ''}
                                </select>
                                <button class="btn btn-primary btn-sm" onclick="App.views['ticket-detail'].updateStatus(${ticket.id})">Update</button>
                            </div>
                        </div>` : ''}

                        <!-- Assignment -->
                        ${isAdminOrManager ? `
                        <div class="card">
                            <div class="card-header"><span class="card-title">Assignment</span></div>
                            ${ticket.assigned_to_name ? `
                                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--info-bg);border-radius:var(--radius-md);margin-bottom:12px">
                                    ${App.utils.avatar(ticket.assigned_to_name, 'staff')}
                                    <div><div style="font-weight:600">${ticket.assigned_to_name}</div><div style="font-size:0.82rem;color:var(--text-secondary)">Current Assignee</div></div>
                                </div>
                            ` : '<p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:12px">Not yet assigned</p>'}
                            <select class="form-control" id="assign-select"><option value="">Select Assignee</option></select>
                            <button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" onclick="App.views['ticket-detail'].assignTicket(${ticket.id})">Assign</button>
                        </div>` : ''}
                    </div>
                </div>`;

            // Load users for assignment dropdown
            if (isAdminOrManager) {
                try {
                    const { users } = await App.api.get('/users');
                    const sel = document.getElementById('assign-select');
                    if (sel) {
                        users.filter(u => u.role === 'staff' || u.role === 'manager').forEach(u => {
                            const o = document.createElement('option');
                            o.value = u.id; o.textContent = `${u.name} (${u.department_name || ''})`;
                            if (ticket.assigned_to === u.id) o.selected = true;
                            sel.appendChild(o);
                        });
                    }
                } catch(e) {}
            }
        } catch(e) {
            document.getElementById('ticket-detail-content').innerHTML = '<div class="empty-state"><div class="empty-state-text">Ticket not found</div></div>';
        }
    },

    async updateStatus(id) {
        const status = document.getElementById('status-select').value;
        try {
            await App.api.put(`/tickets/${id}`, { status });
            App.utils.toast('Status updated!', 'success');
            App.router.resolve();
        } catch(e) {}
    },

    async assignTicket(id) {
        const assigned_to = document.getElementById('assign-select').value;
        if (!assigned_to) { App.utils.toast('Select an assignee', 'warning'); return; }
        try {
            await App.api.post(`/tickets/${id}/assign`, { assigned_to: parseInt(assigned_to) });
            App.utils.toast('Ticket assigned!', 'success');
            App.router.resolve();
        } catch(e) {}
    },

    async addComment(ticketId) {
        const comment = document.getElementById('new-comment').value.trim();
        if (!comment) { App.utils.toast('Comment cannot be empty', 'warning'); return; }
        const internalEl = document.getElementById('comment-internal');
        const is_internal = internalEl ? internalEl.checked : false;
        try {
            await App.api.post(`/tickets/${ticketId}/comments`, { comment, is_internal });
            App.utils.toast('Comment added!', 'success');
            App.router.resolve();
        } catch(e) {}
    }
};
