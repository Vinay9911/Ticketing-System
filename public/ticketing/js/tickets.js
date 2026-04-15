async function loadTickets() {
    try {
        const response = await apiFetch('/tickets');
        const tickets = response.tickets || [];
        const tbody = document.getElementById('tickets-list-tbody');
        
        if (!tbody) return;

        tbody.innerHTML = tickets.map(t => `
            <tr>
                <td>${t.ticket_number}</td>
                <td>${t.title}</td>
                <td>${t.raised_by_name}</td>
                <td>${t.priority}</td>
                <td>${t.status}</td>
                <td>
                    <button onclick="viewTicket(${t.id})">View</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
}

async function createTicket(event) {
    event.preventDefault();
    
    const payload = {
        title: document.getElementById('ticket-title').value,
        description: document.getElementById('ticket-desc').value,
        priority: document.getElementById('ticket-priority').value,
        issue_type: document.getElementById('ticket-issue-type').value
    };

    try {
        await apiFetch('/tickets', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        alert('Ticket Created Successfully!');
        window.location.reload();
    } catch (error) {
        console.error('Error creating ticket:', error);
    }
}

async function updateTicketStatus(ticketId, newStatus) {
    try {
        await apiFetch(`/tickets/${ticketId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        alert('Status Updated!');
        window.location.reload();
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Check if we are on the tickets list page
if (window.location.pathname.includes('tickets')) {
    document.addEventListener('DOMContentLoaded', loadTickets);
}