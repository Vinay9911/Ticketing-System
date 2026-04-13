function login(role, name) {
    localStorage.setItem('userRole', role);
    localStorage.setItem('userName', name);
    if(role === 'Admin' || role === 'Manager') window.location.href = 'html/admin-dashboard.html';
    else window.location.href = 'html/staff-dashboard.html';
}

function logout() {
    localStorage.clear();
    window.location.href = '../index.html';
}

function checkAuth() {
    const role = localStorage.getItem('userRole');
    if (!role) window.location.href = '../index.html';
    
    const welcomeText = document.getElementById('user-welcome');
    if (welcomeText) {
        welcomeText.innerText = `Welcome, ${localStorage.getItem('userName')} (${role})`;
    }
}