/* ════════════════════════════════════════════════════════
   UTILITIES — Formatting, Badges, Toast, Helpers
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

App.utils = {
    // ── Date Formatting ──────────────────────────────────
    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    formatDateTime(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    timeAgo(dateStr) {
        if (!dateStr) return '';
        const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return App.utils.formatDate(dateStr);
    },

    // ── Status Badges ────────────────────────────────────
    statusBadge(status) {
        const map = {
            'available': 'success', 'in_use': 'info', 'under_maintenance': 'warning', 'retired': 'muted',
            'open': 'danger', 'in_progress': 'warning', 'resolved': 'success', 'closed': 'muted',
            'pending': 'warning', 'completed': 'success', 'overdue': 'danger'
        };
        const label = (status || '').replace(/_/g, ' ');
        return `<span class="badge badge-${map[status] || 'muted'}">${label}</span>`;
    },

    priorityBadge(priority) {
        const map = { 'low': 'info', 'medium': 'warning', 'high': 'danger', 'critical': 'critical' };
        return `<span class="badge badge-${map[priority] || 'muted'}">${priority || '—'}</span>`;
    },

    roleBadge(role) {
        const map = { 'admin': 'danger', 'manager': 'warning', 'staff': 'success' };
        return `<span class="badge badge-${map[role] || 'muted'}">${role}</span>`;
    },

    // ── Currency Format ──────────────────────────────────
    formatCurrency(amount) {
        if (!amount && amount !== 0) return '—';
        return '₹' + Number(amount).toLocaleString('en-IN');
    },

    // ── Initials ─────────────────────────────────────────
    initials(name) {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },

    // ── Toast Notification System ────────────────────────
    toast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) container.remove();
        }, 3200);
    },

    // ── Get initials avatar HTML ─────────────────────────
    avatar(name, role, size = 34) {
        const colors = { admin: '#ef4444', manager: '#f59e0b', staff: '#10b981' };
        return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${colors[role] || '#6366f1'};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size * 0.38}px;flex-shrink:0">${App.utils.initials(name)}</div>`;
    },

    // ── Pagination HTML ──────────────────────────────────
    paginationHTML(pagination, onClickFn) {
        if (!pagination || pagination.totalPages <= 1) return '';
        let html = `<div class="pagination">
            <span class="pagination-info">Showing page ${pagination.page} of ${pagination.totalPages} (${pagination.total} records)</span>
            <div class="pagination-controls">`;
        html += `<button class="pagination-btn" ${pagination.page <= 1 ? 'disabled' : ''} onclick="${onClickFn}(${pagination.page - 1})">← Prev</button>`;
        for (let i = Math.max(1, pagination.page - 2); i <= Math.min(pagination.totalPages, pagination.page + 2); i++) {
            html += `<button class="pagination-btn ${i === pagination.page ? 'active' : ''}" onclick="${onClickFn}(${i})">${i}</button>`;
        }
        html += `<button class="pagination-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="${onClickFn}(${pagination.page + 1})">Next →</button>`;
        html += '</div></div>';
        return html;
    },

    // ── Modal helpers ────────────────────────────────────
    showModal(title, bodyHTML, footerHTML = '') {
        const existing = document.querySelector('.modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <span class="modal-title">${title}</span>
                    <button class="modal-close" onclick="App.utils.closeModal()">✕</button>
                </div>
                <div class="modal-body">${bodyHTML}</div>
                ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
            </div>`;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) App.utils.closeModal(); });
        document.body.appendChild(overlay);
    },

    closeModal() {
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) overlay.remove();
    },

    // ── Confirm dialog ───────────────────────────────────
    confirm(message) {
        return window.confirm(message);
    },

    // ── Escape HTML ──────────────────────────────────────
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
