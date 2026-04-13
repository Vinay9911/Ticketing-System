/* ════════════════════════════════════════════════════════
   API — Fetch wrapper with auth headers
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

App.api = {
    BASE_URL: '/api/v1',

    async fetch(endpoint, options = {}) {
        const user = App.state.getUser();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (user) {
            headers['X-User-Role'] = user.role;
            headers['X-User-Id'] = String(user.id);
            headers['X-User-Name'] = user.name;
        }

        try {
            const response = await fetch(`${this.BASE_URL}${endpoint}`, { ...options, headers });

            // Handle file downloads (PDF/Excel)
            const contentType = response.headers.get('Content-Type') || '';
            if (contentType.includes('spreadsheet') || contentType.includes('pdf')) {
                if (!response.ok) throw new Error('Export failed');
                const blob = await response.blob();
                const disposition = response.headers.get('Content-Disposition') || '';
                const match = disposition.match(/filename=(.+)/);
                const filename = match ? match[1] : 'report';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = filename; a.click();
                URL.revokeObjectURL(url);
                return { success: true };
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Request failed (${response.status})`);
            }
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            App.utils.toast(error.message, 'error');
            throw error;
        }
    },

    get(endpoint) { return this.fetch(endpoint); },
    post(endpoint, body) { return this.fetch(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
    put(endpoint, body) { return this.fetch(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
    del(endpoint) { return this.fetch(endpoint, { method: 'DELETE' }); }
};