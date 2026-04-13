function login(role, id, name) {
    localStorage.setItem('userRole', role);
    localStorage.setItem('userId', id);
    localStorage.setItem('userName', name);

    // Route to correct dashboard based on role
    if (role === 'admin') {
        window.location.href = './html/admin-dashboard.html';
    } else if (role === 'manager') {
        window.location.href = './html/manager-dashboard.html';
    } else {
        window.location.href = './html/staff-dashboard.html';
    }
}

function logout() {
    localStorage.clear();
    window.location.href = '../index.html';
}

function checkAuth(requiredRoles = []) {
    const role = localStorage.getItem('userRole');
    if (!role) {
        window.location.href = '../index.html';
        return;
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
        alert('Access Denied: You do not have permission to view this page.');
        window.location.href = '../index.html';
    }

    // Update UI with user name if element exists
    const userNameEl = document.getElementById('user-name-display');
    if (userNameEl) {
        userNameEl.textContent = localStorage.getItem('userName');
    }
}