/* ════════════════════════════════════════════════════════
   VIEW — Ticket List
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['ticket-list'] = {
    title: 'All Tickets',
    _page: 1, _search: '', _status: '', _priority: '',

    render() {
        return `
        <div class="page-header">
            <h1>Tickets</h1>
            <a href="#/tickets/new" class="btn btn-primary">+ Create Ticket</a>
        </div>

        <div class="filter-bar">
            <div class="search-input-wrapper"><span class="search-icon">🔍</span>
                <input type="text" id="ticket-search" placeholder="Search by ticket #, title, user..." value="${this._search}">
            </div>
            <select class="filter-select" id="ticket-status-filter">
                <option value="">All Status</option>
                <option value="open" ${this._status === 'open' ? 'selected' : ''}>Open</option>
                <option value="in_progress" ${this._status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="resolved" ${this._status === 'resolved' ? 'selected' : ''}>Resolved</option>
                <option value="closed" ${this._status === 'closed' ? 'selected' : ''}>Closed</option>
            </select>
            <select class="filter-select" id="ticket-priority-filter">
                <option value="">All Priority</option>
                <option value="critical" ${this._priority === 'critical' ? 'selected' : ''}>Critical</option>
                <option value="high" ${this._priority === 'high' ? 'selected' : ''}>High</option>
                <option value="medium" ${this._priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="low" ${this._priority === 'low' ? 'selected' : ''}>Low</option>
            </select>
        </div>

        <div class="card" style="padding:0">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Ticket #</th><th>Title</th><th>Raised By</th><th>Assigned To</th><th>Priority</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                    <tbody id="ticket-table-body"><tr><td colspan="8"><div class="spinner"></div></td></tr></tbody>
                </table>
            </div>
            <div id="ticket-pagination" style="padding:0 16px 8px"></div>
        </div>`;
    },

    async afterRender(params, queryObj = {}) {
        this._filter = queryObj.filter || '';
        if (this._filter === 'my') {
            document.getElementById('topbar-page-title').textContent = 'My Tickets';
        }

        let debounce;
        document.getElementById('ticket-search').addEventListener('input', (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => { this._search = e.target.value; this._page = 1; this.loadTickets(); }, 400);
        });
        document.getElementById('ticket-status-filter').addEventListener('change', (e) => { this._status = e.target.value; this._page = 1; this.loadTickets(); });
        document.getElementById('ticket-priority-filter').addEventListener('change', (e) => { this._priority = e.target.value; this._page = 1; this.loadTickets(); });
        this.loadTickets();
    },

    async loadTickets() {
        try {
            let url = `/tickets?page=${this._page}&limit=15`;
            if (this._search) url += `&search=${encodeURIComponent(this._search)}`;
            if (this._status) url += `&status=${this._status}`;
            if (this._priority) url += `&priority=${this._priority}`;
            if (this._filter === 'my') url += `&filter=my`;

            const { tickets, pagination } = await App.api.get(url);
            const tbody = document.getElementById('ticket-table-body');
            const isAdmin = App.auth.hasRole('admin');

            if (tickets.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">🎫</div><div class="empty-state-text">No tickets found</div></div></td></tr>';
            } else {
                tbody.innerHTML = tickets.map(t => `
                    <tr>
                        <td><a href="#/tickets/${t.id}" style="font-weight:600;color:var(--primary);font-family:var(--font-mono);font-size:0.82rem">${t.ticket_number}</a></td>
                        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${App.utils.escapeHtml(t.title)}</td>
                        <td style="font-size:0.85rem">${t.raised_by_name || '—'}</td>
                        <td style="font-size:0.85rem">${t.assigned_to_name || '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
                        <td>${App.utils.priorityBadge(t.priority)}</td>
                        <td>${App.utils.statusBadge(t.status)}</td>
                        <td style="font-size:0.82rem;color:var(--text-secondary)">${App.utils.timeAgo(t.created_at)}</td>
                        <td>
                            <div class="table-actions">
                                <a href="#/tickets/${t.id}" class="btn btn-ghost btn-sm">View</a>
                                ${isAdmin ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="App.views['ticket-list'].deleteTicket(${t.id}, '${t.ticket_number}')">Del</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
            document.getElementById('ticket-pagination').innerHTML = App.utils.paginationHTML(pagination, "App.views['ticket-list'].goToPage");
        } catch(e) {}
    },

    goToPage(p) { this._page = p; this.loadTickets(); },

    async deleteTicket(id, num) {
        if (!App.utils.confirm(`Delete ticket ${num}? This cannot be undone.`)) return;
        try { await App.api.del(`/tickets/${id}`); App.utils.toast('Ticket deleted', 'success'); this.loadTickets(); } catch(e) {}
    }
};
