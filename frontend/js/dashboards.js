// This file handles fetching data and building charts/KPIs for the dashboards

async function loadManagerKPIs() {
    // In a real app, this would hit a specific /reports/manager-kpi endpoint
    const ticketData = await apiFetch('/tickets');
    const assetData = await apiFetch('/assets');
    
    if(!ticketData || !assetData) return;

    const totalTickets = ticketData.tickets.length;
    const openTickets = ticketData.tickets.filter(t => t.status === 'open').length;
    const totalAssets = assetData.assets ? assetData.assets.length : 0;

    const kpiContainer = document.getElementById('kpi-container');
    if(kpiContainer) {
        kpiContainer.innerHTML = `
            <div style="display:flex; gap:20px; margin-bottom: 20px;">
                <div class="card" style="flex:1; text-align:center;">
                    <h3>Dept Assets</h3><h2>${totalAssets}</h2>
                </div>
                <div class="card" style="flex:1; text-align:center;">
                    <h3>Total Tickets</h3><h2>${totalTickets}</h2>
                </div>
                <div class="card" style="flex:1; text-align:center;">
                    <h3>Open Tickets</h3><h2 style="color:#e74c3c;">${openTickets}</h2>
                </div>
            </div>
        `;
    }
}

// Logic for the asset page
async function loadAssets() {
    const data = await apiFetch('/assets');
    const tbody = document.getElementById('asset-table-body');
    if(!data || !data.assets || !tbody) return;

    tbody.innerHTML = '';
    data.assets.forEach(a => {
        tbody.innerHTML += `
            <tr>
                <td>${a.name}</td>
                <td>${a.category}</td>
                <td><strong>${a.status.toUpperCase()}</strong></td>
                <td>${a.assigned_to || 'Unassigned'}</td>
            </tr>
        `;
    });
}

// Handle Asset Form Submission
const assetForm = document.getElementById('create-asset-form');
if (assetForm) {
    assetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('asset-name').value,
            category: document.getElementById('asset-category').value
        };
        await apiFetch('/assets', 'POST', payload);
        assetForm.reset();
        loadAssets(); // Reload the table
    });
}