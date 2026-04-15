/* ════════════════════════════════════════════════════════
   VIEW — Notifications
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['notifications'] = {
    title: 'Notifications',

    render() {
        return `
        <div class="page-header">
            <h1>Notifications</h1>
            <button class="btn btn-outline" onclick="App.views['notifications'].markAllRead()">Mark All as Read</button>
        </div>
        <div id="notif-list"><div class="spinner"></div></div>
        <div id="notif-pagination"></div>`;
    },

    async afterRender() { this.load(1); },

    async load(page) {
        try {
            const { notifications, unread, pagination } = await App.api.get(`/notifications?page=${page}&limit=20`);
            const el = document.getElementById('notif-list');

            if (notifications.length === 0) {
                el.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-state-icon">🔔</div><div class="empty-state-text">No notifications</div></div></div>';
                return;
            }

            el.innerHTML = notifications.map(n => {
                const icons = { ticket_created: '🎫', ticket_assigned: '👤', ticket_updated: '📝', comment_added: '💬', maintenance_due: '🔧', asset_assigned: '📦' };
                return `
                <div class="card" style="padding:16px 20px;display:flex;align-items:start;gap:14px;cursor:pointer;opacity:${n.is_read ? '0.6' : '1'};border-left:3px solid ${n.is_read ? 'transparent' : 'var(--primary)'}"
                     onclick="App.views['notifications'].markRead(${n.id}, ${n.reference_id}, '${n.type}')">
                    <div style="font-size:1.4rem;flex-shrink:0">${icons[n.type] || '🔔'}</div>
                    <div style="flex:1">
                        <div style="font-weight:600;font-size:0.92rem;margin-bottom:2px">${App.utils.escapeHtml(n.title)}</div>
                        <div style="font-size:0.85rem;color:var(--text-secondary)">${App.utils.escapeHtml(n.message)}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${App.utils.timeAgo(n.created_at)}</div>
                    </div>
                    ${!n.is_read ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:8px"></div>' : ''}
                </div>`;
            }).join('');

            document.getElementById('notif-pagination').innerHTML = App.utils.paginationHTML(pagination, "App.views['notifications'].load");
        } catch(e) {}
    },

    async markRead(id, refId, type) {
        try {
            await App.api.put(`/notifications/${id}/read`, {});
            App.updateNotificationCount();
            // Navigate to referenced item
            if (refId && (type.includes('ticket') || type === 'comment_added')) {
                window.location.hash = `#/tickets/${refId}`;
            } else if (refId && type.includes('asset')) {
                window.location.hash = `#/assets/${refId}`;
            } else if (refId && type.includes('maintenance')) {
                window.location.hash = '#/maintenance';
            } else {
                this.load(1);
            }
        } catch(e) {}
    },

    async markAllRead() {
        try {
            await App.api.put('/notifications/read-all', {});
            App.utils.toast('All marked as read', 'success');
            App.updateNotificationCount();
            this.load(1);
        } catch(e) {}
    }
};
