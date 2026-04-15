/* ════════════════════════════════════════════════════════
   VIEW — Reports
   ════════════════════════════════════════════════════════ */
window.App = window.App || {};
App.views = App.views || {};

App.views['reports'] = {
    title: 'Reports',

    render() {
        const isAdmin = App.auth.hasRole('admin');
        return `
        <div class="page-header"><h1>Reports & Analytics</h1></div>

        <!-- Report Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:24px">
            <div class="card" style="cursor:pointer;border-left:4px solid var(--primary)" onclick="App.views['reports'].loadReport('asset-inventory')">
                <h3 style="margin-bottom:6px">📦 Asset Inventory</h3>
                <p style="font-size:0.85rem">Full list of all assets with status, category, and cost breakdown</p>
                <div style="margin-top:12px;display:flex;gap:8px">
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.views['reports'].exportReport('asset-inventory','excel')">📥 Excel</button>
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.views['reports'].exportReport('asset-inventory','pdf')">📄 PDF</button>
                </div>
            </div>
            <div class="card" style="cursor:pointer;border-left:4px solid var(--success)" onclick="App.views['reports'].loadReport('maintenance-logs')">
                <h3 style="margin-bottom:6px">🔧 Maintenance Logs</h3>
                <p style="font-size:0.85rem">History of all maintenance records with technician and status</p>
                <div style="margin-top:12px;display:flex;gap:8px">
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.views['reports'].exportReport('maintenance-logs','excel')">📥 Excel</button>
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.views['reports'].exportReport('maintenance-logs','pdf')">📄 PDF</button>
                </div>
            </div>
            <div class="card" style="cursor:pointer;border-left:4px solid var(--warning)" onclick="App.views['reports'].loadReport('ticket-summary')">
                <h3 style="margin-bottom:6px">🎫 Ticket Summary</h3>
                <p style="font-size:0.85rem">Analytics on ticket resolution, priorities, and trends</p>
                <div style="margin-top:12px;display:flex;gap:8px">
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.views['reports'].exportReport('ticket-summary','excel')">📥 Excel</button>
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.views['reports'].exportReport('ticket-summary','pdf')">📄 PDF</button>
                </div>
            </div>
            ${isAdmin ? `
            <div class="card" style="cursor:pointer;border-left:4px solid var(--danger)" onclick="App.views['reports'].loadReport('depreciation')">
                <h3 style="margin-bottom:6px">📉 Depreciation Report</h3>
                <p style="font-size:0.85rem">Asset value depreciation using straight-line method (5yr)</p>
            </div>
            ` : ''}
            <div class="card" style="cursor:pointer;border-left:4px solid var(--info)" onclick="App.views['reports'].loadReport('asset-allocation')">
                <h3 style="margin-bottom:6px">👥 Asset Allocation</h3>
                <p style="font-size:0.85rem">Which assets are assigned to which employees and departments</p>
            </div>
        </div>

        <!-- Report Display Area -->
        <div id="report-display"></div>`;
    },

    async afterRender() {},

    async loadReport(type) {
        const display = document.getElementById('report-display');
        display.innerHTML = '<div class="card"><div class="spinner"></div></div>';

        try {
            if (type === 'asset-inventory') {
                const { assets, summary } = await App.api.get('/reports/asset-inventory');
                display.innerHTML = `
                    <div class="card">
                        <div class="card-header"><span class="card-title">Asset Inventory Report</span></div>
                        <div class="kpi-grid" style="margin-bottom:20px">
                            <div class="kpi-card primary"><div class="kpi-content"><div class="kpi-label">Total Assets</div><div class="kpi-value">${summary.totalAssets}</div></div></div>
                            <div class="kpi-card success"><div class="kpi-content"><div class="kpi-label">Total Value</div><div class="kpi-value">${App.utils.formatCurrency(summary.totalValue)}</div></div></div>
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead><tr><th>Name</th><th>Category</th><th>Status</th><th>Assigned To</th><th>Cost</th></tr></thead>
                                <tbody>${assets.map(a => `<tr><td>${a.name}</td><td>${a.category_name||'—'}</td><td>${App.utils.statusBadge(a.status)}</td><td>${a.assigned_user_name||a.dept_name||'—'}</td><td>${App.utils.formatCurrency(a.cost)}</td></tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </div>`;
            } else if (type === 'ticket-summary') {
                const data = await App.api.get('/reports/ticket-summary');
                display.innerHTML = `
                    <div class="card">
                        <div class="card-header"><span class="card-title">Ticket Summary Report</span></div>
                        <div class="kpi-grid" style="margin-bottom:20px">
                            <div class="kpi-card primary"><div class="kpi-content"><div class="kpi-label">Total Tickets</div><div class="kpi-value">${data.total}</div></div></div>
                            <div class="kpi-card info"><div class="kpi-content"><div class="kpi-label">Avg Resolution</div><div class="kpi-value">${data.avgResolutionHours ? data.avgResolutionHours + 'h' : '—'}</div></div></div>
                        </div>
                        <div class="chart-grid">
                            <div class="chart-card"><div class="chart-card-title">By Issue Type</div><div class="chart-container"><canvas id="rpt-issue-chart"></canvas></div></div>
                            <div class="chart-card"><div class="chart-card-title">Top Raisers</div><div class="chart-container"><canvas id="rpt-raiser-chart"></canvas></div></div>
                        </div>
                    </div>`;
                // Render charts
                if (data.byIssueType?.length) {
                    new Chart(document.getElementById('rpt-issue-chart'), { type: 'bar', data: { labels: data.byIssueType.map(i => i.issue_type.replace('_', ' ')), datasets: [{ data: data.byIssueType.map(i => i.count), backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
                }
                if (data.topRaisers?.length) {
                    new Chart(document.getElementById('rpt-raiser-chart'), { type: 'bar', data: { labels: data.topRaisers.map(r => r.name), datasets: [{ data: data.topRaisers.map(r => r.count), backgroundColor: '#6366f1', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }});
                }
            } else if (type === 'depreciation') {
                const { report, totals } = await App.api.get('/reports/depreciation');
                display.innerHTML = `
                    <div class="card">
                        <div class="card-header"><span class="card-title">📉 Asset Depreciation Report (5-Year Straight Line)</span></div>
                        <div class="kpi-grid" style="margin-bottom:20px">
                            <div class="kpi-card primary"><div class="kpi-content"><div class="kpi-label">Original Value</div><div class="kpi-value">${App.utils.formatCurrency(totals.totalOriginalCost)}</div></div></div>
                            <div class="kpi-card success"><div class="kpi-content"><div class="kpi-label">Current Value</div><div class="kpi-value">${App.utils.formatCurrency(totals.totalCurrentValue)}</div></div></div>
                            <div class="kpi-card danger"><div class="kpi-content"><div class="kpi-label">Total Depreciation</div><div class="kpi-value">${App.utils.formatCurrency(totals.totalDepreciation)}</div></div></div>
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead><tr><th>Asset</th><th>Category</th><th>Purchase Date</th><th>Original Cost</th><th>Age (Yr)</th><th>Current Value</th><th>Depreciation %</th></tr></thead>
                                <tbody>${report.map(r => `<tr><td>${r.name}</td><td>${r.category||'—'}</td><td>${App.utils.formatDate(r.purchaseDate)}</td><td>${App.utils.formatCurrency(r.originalCost)}</td><td>${r.ageYears}</td><td style="font-weight:600;color:${r.currentValue === 0 ? 'var(--danger)' : 'var(--success)'}">${App.utils.formatCurrency(r.currentValue)}</td><td><div style="background:var(--bg-hover);border-radius:var(--radius-full);overflow:hidden;height:18px;position:relative"><div style="background:${r.depreciationPercent >= 80 ? 'var(--danger)' : r.depreciationPercent >= 50 ? 'var(--warning)' : 'var(--success)'};height:100%;width:${r.depreciationPercent}%;border-radius:var(--radius-full)"></div><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:0.7rem;font-weight:600">${r.depreciationPercent}%</span></div></td></tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </div>`;
            } else if (type === 'maintenance-logs') {
                const { logs, summary } = await App.api.get('/reports/maintenance-logs');
                display.innerHTML = `
                    <div class="card">
                        <div class="card-header"><span class="card-title">Maintenance Logs</span></div>
                        <div class="kpi-grid" style="margin-bottom:20px">
                            <div class="kpi-card primary"><div class="kpi-content"><div class="kpi-label">Total</div><div class="kpi-value">${summary.total}</div></div></div>
                            <div class="kpi-card success"><div class="kpi-content"><div class="kpi-label">Completed</div><div class="kpi-value">${summary.completed}</div></div></div>
                            <div class="kpi-card danger"><div class="kpi-content"><div class="kpi-label">Overdue</div><div class="kpi-value">${summary.overdue}</div></div></div>
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead><tr><th>Asset</th><th>Type</th><th>Scheduled</th><th>Status</th><th>Technician</th><th>Completed</th></tr></thead>
                                <tbody>${logs.map(l => `<tr><td>${l.asset_name||'—'}</td><td>${l.maintenance_type||'—'}</td><td>${App.utils.formatDate(l.scheduled_date)}</td><td>${App.utils.statusBadge(l.status)}</td><td>${l.technician_name||'—'}</td><td>${App.utils.formatDate(l.completed_at)}</td></tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </div>`;
            } else if (type === 'asset-allocation') {
                const data = await App.api.get('/reports/asset-allocation');
                display.innerHTML = `
                    <div class="card">
                        <div class="card-header"><span class="card-title">Asset Allocation</span></div>
                        <div class="kpi-grid" style="margin-bottom:20px"><div class="kpi-card warning"><div class="kpi-content"><div class="kpi-label">Unassigned Assets</div><div class="kpi-value">${data.unassigned}</div></div></div></div>
                        <h4 style="margin:16px 0 8px">By Employee</h4>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead><tr><th>Employee</th><th>Department</th><th>Assets</th><th>Details</th></tr></thead>
                                <tbody>${data.byUser.map(u => `<tr><td style="font-weight:600">${u.assignee}</td><td>${u.department||'—'}</td><td><span class="badge badge-primary">${u.asset_count}</span></td><td style="font-size:0.82rem;color:var(--text-secondary);max-width:300px">${u.assets}</td></tr>`).join('')}</tbody>
                            </table>
                        </div>
                        <h4 style="margin:16px 0 8px">By Department</h4>
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead><tr><th>Department</th><th>Assets</th><th>Total Value</th></tr></thead>
                                <tbody>${data.byDept.map(d => `<tr><td style="font-weight:600">${d.department}</td><td><span class="badge badge-primary">${d.asset_count}</span></td><td>${App.utils.formatCurrency(d.total_value)}</td></tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </div>`;
            }
        } catch(e) {
            display.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-state-text">Failed to load report</div></div></div>';
        }
    },

    async exportReport(type, format) {
        App.utils.toast(`Generating ${format.toUpperCase()} export...`, 'info');
        try {
            await App.api.post('/reports/export', { reportType: type, format });
            App.utils.toast('Download started!', 'success');
        } catch(e) {}
    }
};
