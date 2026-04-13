// --- NEW: ASSET PAGE LOGIC ---

async function loadAssetsPage() {
    try {
        const response = await apiFetch('/assets');
        const tbody = document.getElementById('assets-list-tbody');
        if (!tbody) return;

        if (response.assets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">No assets found.</td></tr>`;
            return;
        }

        tbody.innerHTML = response.assets.map(a => `
            <tr>
                <td><strong>${a.name}</strong></td>
                <td>${a.serial_number || 'N/A'}</td>
                <td>${a.category_name || 'N/A'}</td>
                <td><span class="badge ${a.status}">${a.status.replace('_', ' ').toUpperCase()}</span></td>
                <td>${a.assigned_user_name || 'Unassigned'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Failed to load assets:", error);
    }
}

async function createAsset(event) {
    event.preventDefault();
    
    const payload = {
        name: document.getElementById('asset-name').value,
        serial_number: document.getElementById('asset-serial').value,
        category_id: document.getElementById('asset-category').value
    };

    try {
        await apiFetch('/assets', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        alert('Asset Created Successfully!');
        
        // Reset form and reload table
        document.getElementById('create-asset-form').reset();
        loadAssetsPage(); 
    } catch (error) {
        console.error('Error creating asset:', error);
    }
}