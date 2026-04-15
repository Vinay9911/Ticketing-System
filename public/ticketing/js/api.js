/* ════════════════════════════════════════════════════════
   API — Fetch wrapper with JWT auth
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};

App.api = {
    BASE_URL: '/api/ticketing',

    async fetch(endpoint, options = {}) {
        const isFormData = options.body instanceof FormData;
        const headers = { ...options.headers };

        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        // Attach JWT token from state
        const token = App.state.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
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

            // If token is invalid/expired, force logout
            if (response.status === 401) {
                App.auth.logout();
                throw new Error('Session expired. Please login again.');
            }

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
    postFormData(endpoint, formData) { return this.fetch(endpoint, { method: 'POST', body: formData }); },
    put(endpoint, body) { return this.fetch(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
    putFormData(endpoint, formData) { return this.fetch(endpoint, { method: 'PUT', body: formData }); },
    del(endpoint) { return this.fetch(endpoint, { method: 'DELETE' }); }
};