const API_BASE_URL = 'http://localhost:3000/api/v1';

async function apiFetch(endpoint, options = {}) {
    // Retrieve simulated auth data from localStorage
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Attach custom headers if user is logged in
    if (role && userId) {
        headers['X-User-Role'] = role;
        headers['X-User-Id'] = userId;
        headers['X-User-Name'] = userName;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API Request Failed');
        }

        return data;
    } catch (error) {
        console.error(`API Error at ${endpoint}:`, error);
        alert(error.message);
        throw error;
    }
}