const BASE_URL = 'http://localhost:3000/api';

async function apiFetch(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'X-User-Role': localStorage.getItem('userRole'),
        'X-User-Name': localStorage.getItem('userName')
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        alert("Failed to connect to the backend server.");
    }
}