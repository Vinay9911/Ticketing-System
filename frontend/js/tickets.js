// ==========================================
// LIST VIEW LOGIC (Used on Dashboards)
// ==========================================

async function loadTickets(isAdminView) {
    const data = await apiFetch('/tickets');
    if (!data || !data.tickets) return;

    const tbody = document.getElementById('ticket-table-body');
    if (!tbody) return; // Exit if not on a dashboard list page
    tbody.innerHTML = '';

    data.tickets.forEach(t => {
        if (isAdminView) {
            // Admin/Manager View (Shows who raised it)
            tbody.innerHTML += `
                <tr>
                    <td>${t.ticket_number}</td>
                    <td>${t.title}</td>
                    <td>${t.priority.toUpperCase()}</td>
                    <td>${t.raised_by_name}</td>
                    <td><strong>${t.status.toUpperCase()}</strong></td>
                    <td>
                        <button onclick="window.location.href='ticket-detail.html?id=${t.id}'" style="padding: 6px 12px; background: #34495e; color: white; border: none; border-radius: 4px; cursor: pointer;">View Details</button>
                    </td>
                </tr>
            `;
        } else {
            // Staff View (Simpler)
            tbody.innerHTML += `
                <tr>
                    <td>${t.ticket_number}</td>
                    <td>${t.title}</td>
                    <td>${t.priority.toUpperCase()}</td>
                    <td><strong>${t.status.toUpperCase()}</strong></td>
                    <td>
                        <button onclick="window.location.href='ticket-detail.html?id=${t.id}'" style="padding: 6px 12px; background: #34495e; color: white; border: none; border-radius: 4px; cursor: pointer;">View</button>
                    </td>
                </tr>
            `;
        }
    });
}

// Handle Creating a New Ticket (Staff Dashboard)
const form = document.getElementById('create-ticket-form');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            title: document.getElementById('title').value,
            description: document.getElementById('desc').value,
            priority: document.getElementById('priority').value
        };
        
        await apiFetch('/tickets', 'POST', payload);
        form.reset();
        loadTickets(false); // Reload staff table
    });
}

// ==========================================
// DETAIL VIEW LOGIC (Used on ticket-detail.html)
// ==========================================

// Helper to get ID from URL
function getTicketIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Load a single ticket
async function loadTicketDetail() {
    const ticketId = getTicketIdFromUrl();
    if (!ticketId) return;

    const data = await apiFetch(`/tickets/${ticketId}`);
    const container = document.getElementById('ticket-detail-container');
    
    if (!data || !data.ticket) {
        if(container) container.innerHTML = "<p style='color: red;'>Ticket not found or error loading data.</p>";
        return;
    }

    const t = data.ticket;
    
    // Set the current status in the dropdown so the Admin sees the active state
    const statusDropdown = document.getElementById('update-status-dropdown');
    if (statusDropdown) statusDropdown.value = t.status;

    if(container) {
        container.innerHTML = `
            <div class="detail-group">
                <div class="detail-label">Ticket Number</div>
                <div class="detail-value"><strong>${t.ticket_number}</strong></div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Issue Title</div>
                <div class="detail-value">${t.title}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Detailed Description</div>
                <div class="detail-value desc-box">${t.description || 'No detailed description provided.'}</div>
            </div>
            <div style="display: flex; gap: 40px; margin-top: 20px;">
                <div class="detail-group">
                    <div class="detail-label">Priority</div>
                    <div class="detail-value">${t.priority.toUpperCase()}</div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Current Status</div>
                    <div class="detail-value"><span class="status-badge status-${t.status}">${t.status.toUpperCase()}</span></div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Raised By</div>
                    <div class="detail-value">${t.raised_by_name} <span style="color:#7f8c8d; font-size:0.9em;">(${t.raised_by_role})</span></div>
                </div>
            </div>
            <div class="detail-group" style="margin-top: 10px;">
                <div class="detail-label">Created At</div>
                <div class="detail-value" style="color: #7f8c8d; font-size: 14px;">${new Date(t.created_at).toLocaleString()}</div>
            </div>
        `;
    }
}

// Handle Status Update (Admin/Manager on Detail Page)
async function saveTicketStatus() {
    const ticketId = getTicketIdFromUrl();
    const newStatus = document.getElementById('update-status-dropdown').value;
    
    if(!ticketId) return;

    await apiFetch(`/tickets/${ticketId}/status`, 'PUT', { status: newStatus });
    alert("Ticket status updated successfully!");
    loadTicketDetail(); // Refresh the page to show the new badge
}