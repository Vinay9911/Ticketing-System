const db = require('../config/db');

// ─── GET /reports/asset-inventory ────────────────────────
exports.assetInventory = (req, res) => {
    try {
        const { status, category_id, department_id } = req.query;
        let conditions = ['a.is_deleted = 0'];
        let params = [];

        if (status) { conditions.push('a.status = ?'); params.push(status); }
        if (category_id) { conditions.push('a.category_id = ?'); params.push(parseInt(category_id)); }
        if (department_id) { conditions.push('a.assigned_to_dept = ?'); params.push(parseInt(department_id)); }

        // Manager scoping
        if (req.user.role === 'manager') {
            conditions.push(`(a.assigned_to_dept = ? OR a.assigned_to_user IN (SELECT id FROM users WHERE department_id = ?))`);
            params.push(req.user.departmentId, req.user.departmentId);
        }

        const where = conditions.join(' AND ');
        const assets = db.prepare(`
            SELECT a.*, c.name as category_name, u.name as assigned_user_name, d.name as dept_name
            FROM assets a
            LEFT JOIN asset_categories c ON a.category_id = c.id
            LEFT JOIN users u ON a.assigned_to_user = u.id
            LEFT JOIN departments d ON a.assigned_to_dept = d.id
            WHERE ${where}
            ORDER BY a.name
        `).all(...params);

        const summary = {
            totalAssets: assets.length,
            totalValue: assets.reduce((sum, a) => sum + (a.cost || 0), 0),
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
exports.maintenanceLogs = (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT m.*, a.name as asset_name, a.serial_number, u.name as technician_name
            FROM maintenance_schedules m
            LEFT JOIN assets a ON m.asset_id = a.id
            LEFT JOIN users u ON m.assigned_to = u.id
            ORDER BY m.scheduled_date DESC
        `).all();

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
exports.ticketSummary = (req, res) => {
    try {
        const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM tickets GROUP BY status').all();
        const byPriority = db.prepare('SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority').all();
        const byIssueType = db.prepare('SELECT issue_type, COUNT(*) as count FROM tickets GROUP BY issue_type ORDER BY count DESC').all();

        const avgRes = db.prepare(`
            SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) as avg_hours
            FROM tickets WHERE resolved_at IS NOT NULL
        `).get();

        const monthly = db.prepare(`
            SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
            FROM tickets GROUP BY month ORDER BY month DESC LIMIT 12
        `).all();

        const topRaisers = db.prepare(`
            SELECT u.name, COUNT(t.id) as count FROM tickets t
            JOIN users u ON t.raised_by = u.id GROUP BY t.raised_by ORDER BY count DESC LIMIT 5
        `).all();

        res.json({
            byStatus, byPriority, byIssueType,
            avgResolutionHours: avgRes.avg_hours ? Math.round(avgRes.avg_hours) : null,
            monthly, topRaisers,
            total: byStatus.reduce((s, r) => s + r.count, 0)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /reports/depreciation ───────────────────────────
exports.depreciation = (req, res) => {
    try {
        const assets = db.prepare(`
            SELECT a.*, c.name as category_name
            FROM assets a
            LEFT JOIN asset_categories c ON a.category_id = c.id
            WHERE a.is_deleted = 0 AND a.cost IS NOT NULL AND a.purchase_date IS NOT NULL
            ORDER BY a.purchase_date ASC
        `).all();

        const usefulLifeYears = 5; // Straight-line depreciation over 5 years
        const now = new Date();

        const report = assets.map(a => {
            const purchaseDate = new Date(a.purchase_date);
            const ageYears = (now - purchaseDate) / (365.25 * 24 * 60 * 60 * 1000);
            const annualDepreciation = a.cost / usefulLifeYears;
            const totalDepreciation = Math.min(annualDepreciation * ageYears, a.cost);
            const currentValue = Math.max(a.cost - totalDepreciation, 0);

            return {
                id: a.id, name: a.name, category: a.category_name,
                purchaseDate: a.purchase_date, originalCost: a.cost,
                ageYears: Math.round(ageYears * 10) / 10,
                annualDepreciation: Math.round(annualDepreciation),
                totalDepreciation: Math.round(totalDepreciation),
                currentValue: Math.round(currentValue),
                depreciationPercent: Math.round((totalDepreciation / a.cost) * 100)
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
exports.assetAllocation = (req, res) => {
    try {
        const byUser = db.prepare(`
            SELECT u.name as assignee, u.email, d.name as department, COUNT(a.id) as asset_count,
                   GROUP_CONCAT(a.name, ', ') as assets
            FROM assets a
            JOIN users u ON a.assigned_to_user = u.id
            WHERE a.is_deleted = 0 AND a.assigned_to_user IS NOT NULL
            GROUP BY a.assigned_to_user ORDER BY asset_count DESC
        `).all();

        const byDept = db.prepare(`
            SELECT d.name as department, COUNT(a.id) as asset_count,
                   SUM(a.cost) as total_value
            FROM assets a
            JOIN departments d ON a.assigned_to_dept = d.id
            WHERE a.is_deleted = 0 AND a.assigned_to_dept IS NOT NULL
            GROUP BY a.assigned_to_dept ORDER BY asset_count DESC
        `).all();

        const unassigned = db.prepare(`
            SELECT COUNT(*) as c FROM assets
            WHERE is_deleted = 0 AND assigned_to_user IS NULL AND assigned_to_dept IS NULL AND status != 'retired'
        `).get().c;

        res.json({ byUser, byDept, unassigned });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /reports/export ────────────────────────────────
exports.exportReport = async (req, res) => {
    try {
        const { reportType, format } = req.body;

        // Enforce role restrictions per report type
        if (reportType === 'depreciation' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can export depreciation reports' });
        }

        if (format === 'excel') {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Report');

            let data = [];
            if (reportType === 'asset-inventory') {
                data = db.prepare(`SELECT a.name, c.name as category, a.serial_number, a.status, a.cost,
                    a.location, u.name as assigned_to FROM assets a
                    LEFT JOIN asset_categories c ON a.category_id = c.id
                    LEFT JOIN users u ON a.assigned_to_user = u.id WHERE a.is_deleted = 0`).all();
                sheet.columns = [
                    { header: 'Name', key: 'name', width: 30 }, { header: 'Category', key: 'category', width: 20 },
                    { header: 'Serial', key: 'serial_number', width: 20 }, { header: 'Status', key: 'status', width: 15 },
                    { header: 'Cost', key: 'cost', width: 15 }, { header: 'Location', key: 'location', width: 25 },
                    { header: 'Assigned To', key: 'assigned_to', width: 20 }
                ];
            } else if (reportType === 'ticket-summary') {
                data = db.prepare(`SELECT t.ticket_number, t.title, t.priority, t.status, t.issue_type,
                    u.name as raised_by, t.created_at FROM tickets t
                    LEFT JOIN users u ON t.raised_by = u.id`).all();
                sheet.columns = [
                    { header: 'Ticket #', key: 'ticket_number', width: 15 }, { header: 'Title', key: 'title', width: 40 },
                    { header: 'Priority', key: 'priority', width: 12 }, { header: 'Status', key: 'status', width: 15 },
                    { header: 'Issue Type', key: 'issue_type', width: 18 }, { header: 'Raised By', key: 'raised_by', width: 20 },
                    { header: 'Created', key: 'created_at', width: 20 }
                ];
            } else if (reportType === 'maintenance-logs') {
                data = db.prepare(`SELECT a.name as asset_name, m.maintenance_type, m.scheduled_date, m.status,
                    u.name as technician, m.completed_at FROM maintenance_schedules m
                    LEFT JOIN assets a ON m.asset_id = a.id LEFT JOIN users u ON m.assigned_to = u.id`).all();
                sheet.columns = [
                    { header: 'Asset', key: 'asset_name', width: 30 }, { header: 'Type', key: 'maintenance_type', width: 20 },
                    { header: 'Scheduled', key: 'scheduled_date', width: 15 }, { header: 'Status', key: 'status', width: 12 },
                    { header: 'Technician', key: 'technician', width: 20 }, { header: 'Completed', key: 'completed_at', width: 20 }
                ];
            }

            // Style header
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

            // Header
            doc.fontSize(20).fillColor('#4F46E5').text('Asset Management System', { align: 'center' });
            doc.fontSize(14).fillColor('#333').text(`${reportType.replace(/-/g, ' ').toUpperCase()} REPORT`, { align: 'center' });
            doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown(2);

            if (reportType === 'asset-inventory') {
                const assets = db.prepare(`SELECT a.name, a.serial_number, a.status, a.cost FROM assets a WHERE a.is_deleted = 0`).all();
                doc.fontSize(12).fillColor('#333');
                assets.forEach((a, i) => {
                    doc.text(`${i + 1}. ${a.name} | SN: ${a.serial_number || 'N/A'} | Status: ${a.status} | ₹${a.cost || 0}`);
                    doc.moveDown(0.3);
                });
            } else if (reportType === 'ticket-summary') {
                const tickets = db.prepare(`SELECT t.ticket_number, t.title, t.priority, t.status FROM tickets t`).all();
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
