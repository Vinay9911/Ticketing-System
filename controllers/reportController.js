const db = require('../services/dbService');

// ─── GET /reports/asset-inventory ────────────────────────
exports.assetInventory = async (req, res) => {
    try {
        const { status, category_id, department_id } = req.query;
        let conditions = ['a.is_deleted = FALSE'];
        let params = [];
        let idx = 1;

        if (status) { conditions.push(`a.status = $${idx++}`); params.push(status); }
        if (category_id) { conditions.push(`a.category_id = $${idx++}`); params.push(parseInt(category_id)); }
        if (department_id) { conditions.push(`a.assigned_to_dept = $${idx++}`); params.push(parseInt(department_id)); }

        if (req.user.role === 'manager') {
            conditions.push(`(a.assigned_to_dept = $${idx} OR a.assigned_to_user IN (SELECT id FROM ts_users WHERE department_id = $${idx + 1}))`);
            params.push(req.user.departmentId, req.user.departmentId);
            idx += 2;
        }

        const assets = await db.reports.assetInventory({ conditions, params });

        const summary = {
            totalAssets: assets.length,
            totalValue: assets.reduce((sum, a) => sum + (parseFloat(a.cost) || 0), 0),
            byStatus: {},
            byCategory: {}
        };
        assets.forEach(a => {
            summary.byStatus[a.status] = (summary.byStatus[a.status] || 0) + 1;
            const cat = a.category_name || 'Uncategorized';
            summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;
        });

        res.json({ assets, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /reports/maintenance-logs ───────────────────────
exports.maintenanceLogs = async (req, res) => {
    try {
        const logs = await db.reports.maintenanceLogs();
        const summary = {
            total: logs.length,
            completed: logs.filter(l => l.status === 'completed').length,
            pending: logs.filter(l => l.status === 'pending').length,
            overdue: logs.filter(l => l.status === 'overdue').length
        };
        res.json({ logs, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /reports/ticket-summary ─────────────────────────
exports.ticketSummary = async (req, res) => {
    try {
        const report = await db.reports.ticketSummary();
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /reports/depreciation ───────────────────────────
exports.depreciation = async (req, res) => {
    try {
        const assets = await db.reports.depreciation();
        const usefulLifeYears = 5;
        const now = new Date();

        const report = assets.map(a => {
            const purchaseDate = new Date(a.purchase_date);
            const ageYears = (now - purchaseDate) / (365.25 * 24 * 60 * 60 * 1000);
            const cost = parseFloat(a.cost);
            const annualDepreciation = cost / usefulLifeYears;
            const totalDepreciation = Math.min(annualDepreciation * ageYears, cost);
            const currentValue = Math.max(cost - totalDepreciation, 0);

            return {
                id: a.id, name: a.name, category: a.category_name,
                purchaseDate: a.purchase_date, originalCost: cost,
                ageYears: Math.round(ageYears * 10) / 10,
                annualDepreciation: Math.round(annualDepreciation),
                totalDepreciation: Math.round(totalDepreciation),
                currentValue: Math.round(currentValue),
                depreciationPercent: Math.round((totalDepreciation / cost) * 100)
            };
        });

        const totals = {
            totalOriginalCost: report.reduce((s, r) => s + r.originalCost, 0),
            totalCurrentValue: report.reduce((s, r) => s + r.currentValue, 0),
            totalDepreciation: report.reduce((s, r) => s + r.totalDepreciation, 0)
        };

        res.json({ report, totals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /reports/asset-allocation ───────────────────────
exports.assetAllocation = async (req, res) => {
    try {
        const data = await db.reports.assetAllocation();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /reports/export ────────────────────────────────
exports.exportReport = async (req, res) => {
    try {
        const { reportType, format } = req.body;

        if (reportType === 'depreciation' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can export depreciation reports' });
        }

        if (format === 'excel') {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Report');

            let data = [];
            if (reportType === 'asset-inventory') {
                data = await db.reports.exportAssetData();
                sheet.columns = [
                    { header: 'Name', key: 'name', width: 30 }, { header: 'Category', key: 'category', width: 20 },
                    { header: 'Serial', key: 'serial_number', width: 20 }, { header: 'Status', key: 'status', width: 15 },
                    { header: 'Cost', key: 'cost', width: 15 }, { header: 'Location', key: 'location', width: 25 },
                    { header: 'Assigned To', key: 'assigned_to', width: 20 }
                ];
            } else if (reportType === 'ticket-summary') {
                data = await db.reports.exportTicketData();
                sheet.columns = [
                    { header: 'Ticket #', key: 'ticket_number', width: 15 }, { header: 'Title', key: 'title', width: 40 },
                    { header: 'Priority', key: 'priority', width: 12 }, { header: 'Status', key: 'status', width: 15 },
                    { header: 'Issue Type', key: 'issue_type', width: 18 }, { header: 'Raised By', key: 'raised_by', width: 20 },
                    { header: 'Created', key: 'created_at', width: 20 }
                ];
            } else if (reportType === 'maintenance-logs') {
                data = await db.reports.exportMaintenanceData();
                sheet.columns = [
                    { header: 'Asset', key: 'asset_name', width: 30 }, { header: 'Type', key: 'maintenance_type', width: 20 },
                    { header: 'Scheduled', key: 'scheduled_date', width: 15 }, { header: 'Status', key: 'status', width: 12 },
                    { header: 'Technician', key: 'technician', width: 20 }, { header: 'Completed', key: 'completed_at', width: 20 }
                ];
            }

            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

            data.forEach(row => sheet.addRow(row));

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report.xlsx`);
            await workbook.xlsx.write(res);
            res.end();

        } else if (format === 'pdf') {
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 50, size: 'A4' });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report.pdf`);
            doc.pipe(res);

            doc.fontSize(20).fillColor('#4F46E5').text('Asset Management System', { align: 'center' });
            doc.fontSize(14).fillColor('#333').text(`${reportType.replace(/-/g, ' ').toUpperCase()} REPORT`, { align: 'center' });
            doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown(2);

            if (reportType === 'asset-inventory') {
                const assets = await db.reports.exportAssetsPDF();
                doc.fontSize(12).fillColor('#333');
                assets.forEach((a, i) => {
                    doc.text(`${i + 1}. ${a.name} | SN: ${a.serial_number || 'N/A'} | Status: ${a.status} | ₹${a.cost || 0}`);
                    doc.moveDown(0.3);
                });
            } else if (reportType === 'ticket-summary') {
                const tickets = await db.reports.exportTicketsPDF();
                tickets.forEach((t, i) => {
                    doc.text(`${t.ticket_number} | ${t.title} | ${t.priority} | ${t.status}`);
                    doc.moveDown(0.3);
                });
            }

            doc.end();
        } else {
            res.status(400).json({ error: 'Format must be "pdf" or "excel"' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
