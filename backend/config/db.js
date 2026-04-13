const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'database.db');
const db = new Database(dbPath);

// Performance & integrity settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ──────────────────────────────────────────
// TABLE CREATION
// ──────────────────────────────────────────
db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT CHECK(role IN ('admin','manager','staff')) NOT NULL,
        department_id INTEGER REFERENCES departments(id),
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES asset_categories(id),
        serial_number TEXT UNIQUE,
        purchase_date TEXT,
        cost REAL,
        warranty_expiry TEXT,
        location TEXT,
        status TEXT CHECK(status IN ('available','in_use','under_maintenance','retired')) DEFAULT 'available',
        assigned_to_user INTEGER REFERENCES users(id),
        assigned_to_dept INTEGER REFERENCES departments(id),
        notes TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER REFERENCES assets(id),
        action_type TEXT NOT NULL,
        performed_by INTEGER REFERENCES users(id),
        previous_value TEXT,
        new_value TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER REFERENCES assets(id),
        scheduled_date TEXT NOT NULL,
        maintenance_type TEXT,
        assigned_to INTEGER REFERENCES users(id),
        status TEXT CHECK(status IN ('pending','completed','overdue')) DEFAULT 'pending',
        notes TEXT,
        completed_at TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        asset_id INTEGER REFERENCES assets(id),
        raised_by INTEGER NOT NULL REFERENCES users(id),
        assigned_to INTEGER REFERENCES users(id),
        issue_type TEXT NOT NULL,
        priority TEXT CHECK(priority IN ('low','medium','high','critical')) NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT CHECK(status IN ('open','in_progress','resolved','closed')) DEFAULT 'open',
        attachments TEXT,
        resolved_at TEXT,
        closed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER REFERENCES tickets(id),
        user_id INTEGER REFERENCES users(id),
        comment TEXT NOT NULL,
        is_internal INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        reference_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        old_data TEXT,
        new_data TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
`);

// ──────────────────────────────────────────
// INDEXES
// ──────────────────────────────────────────
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
    CREATE INDEX IF NOT EXISTS idx_assets_assigned_user ON assets(assigned_to_user);
    CREATE INDEX IF NOT EXISTS idx_assets_assigned_dept ON assets(assigned_to_dept);
    CREATE INDEX IF NOT EXISTS idx_assets_deleted ON assets(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_asset_history_asset ON asset_history(asset_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_schedules(asset_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_schedules(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_tickets_raised_by ON tickets(raised_by);
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
`);

// ──────────────────────────────────────────
// SEED DATA (only on first run)
// ──────────────────────────────────────────
const count = db.prepare('SELECT COUNT(*) as c FROM departments').get();
if (count.c === 0) {
    console.log('Seeding initial data...');

    const seedTransaction = db.transaction(() => {
        // Departments
        db.prepare("INSERT INTO departments (id, name) VALUES (?, ?)").run(1, 'IT Department');
        db.prepare("INSERT INTO departments (id, name) VALUES (?, ?)").run(2, 'Human Resources');
        db.prepare("INSERT INTO departments (id, name) VALUES (?, ?)").run(3, 'Finance');
        db.prepare("INSERT INTO departments (id, name) VALUES (?, ?)").run(4, 'Operations');

        // Users
        db.prepare("INSERT INTO users (id, name, email, role, department_id) VALUES (?, ?, ?, ?, ?)").run(1, 'Rajesh Kumar', 'rajesh@company.com', 'admin', 1);
        db.prepare("INSERT INTO users (id, name, email, role, department_id) VALUES (?, ?, ?, ?, ?)").run(2, 'Sneha Iyer', 'sneha@company.com', 'admin', 1);
        db.prepare("INSERT INTO users (id, name, email, role, department_id) VALUES (?, ?, ?, ?, ?)").run(3, 'Priya Sharma', 'priya@company.com', 'manager', 1);
        db.prepare("INSERT INTO users (id, name, email, role, department_id) VALUES (?, ?, ?, ?, ?)").run(4, 'Neha Gupta', 'neha@company.com', 'manager', 2);
        db.prepare("INSERT INTO users (id, name, email, role, department_id) VALUES (?, ?, ?, ?, ?)").run(5, 'Amit Patel', 'amit@company.com', 'staff', 1);
        db.prepare("INSERT INTO users (id, name, email, role, department_id) VALUES (?, ?, ?, ?, ?)").run(6, 'Vikram Singh', 'vikram@company.com', 'staff', 1);
        db.prepare("INSERT INTO users (id, name, email, role, department_id) VALUES (?, ?, ?, ?, ?)").run(7, 'Kavya Nair', 'kavya@company.com', 'staff', 2);
        db.prepare("INSERT INTO users (id, name, email, role, department_id) VALUES (?, ?, ?, ?, ?)").run(8, 'Rohan Mehta', 'rohan@company.com', 'staff', 3);

        // Asset Categories
        db.prepare("INSERT INTO asset_categories (id, name, description) VALUES (?, ?, ?)").run(1, 'IT Equipment', 'Laptops, monitors, printers, networking gear');
        db.prepare("INSERT INTO asset_categories (id, name, description) VALUES (?, ?, ?)").run(2, 'Furniture', 'Desks, chairs, cabinets, shelves');
        db.prepare("INSERT INTO asset_categories (id, name, description) VALUES (?, ?, ?)").run(3, 'Vehicles', 'Company cars, vans, delivery vehicles');
        db.prepare("INSERT INTO asset_categories (id, name, description) VALUES (?, ?, ?)").run(4, 'Office Supplies', 'Stationery, whiteboards, accessories');
        db.prepare("INSERT INTO asset_categories (id, name, description) VALUES (?, ?, ?)").run(5, 'Software Licenses', 'Operating systems, productivity suites, dev tools');

        // Assets (12 items across categories and statuses)
        const insertAsset = db.prepare(`INSERT INTO assets (id, name, category_id, serial_number, purchase_date, cost, warranty_expiry, location, status, assigned_to_user, assigned_to_dept, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        insertAsset.run(1, 'Dell XPS 15 Laptop', 1, 'SN-DELL-001', '2024-03-15', 125000, '2027-03-15', 'Floor 2, Desk 12', 'available', null, 1, 'High performance developer laptop', 1);
        insertAsset.run(2, 'MacBook Pro 16"', 1, 'SN-MAC-002', '2024-06-20', 245000, '2027-06-20', 'Floor 2, Desk 8', 'in_use', 5, 1, 'Design team primary workstation', 1);
        insertAsset.run(3, 'HP EliteDisplay 27" Monitor', 1, 'SN-HP-003', '2024-01-10', 32000, '2027-01-10', 'Floor 2, Desk 5', 'in_use', 3, 1, '4K IPS display', 1);
        insertAsset.run(4, 'Lenovo ThinkPad X1 Carbon', 1, 'SN-LEN-004', '2023-08-01', 155000, '2026-08-01', 'Service Center', 'under_maintenance', null, 1, 'Battery replacement in progress', 1);
        insertAsset.run(5, 'Executive Office Desk', 2, 'SN-FUR-005', '2023-01-15', 45000, null, 'Floor 3, Room 301', 'in_use', 1, 1, 'L-shaped mahogany desk', 1);
        insertAsset.run(6, 'Ergonomic Office Chair', 2, 'SN-FUR-006', '2024-02-20', 28000, '2029-02-20', 'Storage Room B', 'available', null, null, 'Herman Miller Aeron', 1);
        insertAsset.run(7, 'Toyota Innova Crysta', 3, 'SN-VEH-007', '2023-11-05', 1850000, '2026-11-05', 'Parking Basement B1', 'in_use', null, 4, 'Company transport vehicle', 1);
        insertAsset.run(8, 'Microsoft 365 E3 License', 5, 'SN-SW-008', '2025-01-01', 95000, '2026-01-01', 'N/A - Digital', 'in_use', null, 1, '50-user enterprise license pack', 1);
        insertAsset.run(9, 'Canon ImageRunner Printer', 1, 'SN-CAN-009', '2023-05-10', 65000, '2026-05-10', 'Floor 1, Print Room', 'available', null, 1, 'Color laser multifunction printer', 1);
        insertAsset.run(10, 'Epson EB-X51 Projector', 1, 'SN-EPS-010', '2020-07-20', 42000, '2023-07-20', 'Conference Room A', 'retired', null, 1, 'Bulb failure, replaced by new unit', 1);
        insertAsset.run(11, 'Standing Desk Converter', 2, 'SN-FUR-011', '2024-09-01', 18000, null, 'Floor 2, Open Area', 'available', null, null, 'Adjustable height desk riser', 1);
        insertAsset.run(12, 'iPad Pro 12.9"', 1, 'SN-APL-012', '2025-02-14', 112000, '2028-02-14', 'Floor 1, Reception', 'in_use', 6, 1, 'Visitor check-in kiosk tablet', 1);

        // Asset History
        const insertHistory = db.prepare("INSERT INTO asset_history (asset_id, action_type, performed_by, previous_value, new_value, notes) VALUES (?, ?, ?, ?, ?, ?)");
        insertHistory.run(2, 'assigned', 1, JSON.stringify({status:'available', assigned_to_user: null}), JSON.stringify({status:'in_use', assigned_to_user: 5}), 'Assigned to Amit Patel');
        insertHistory.run(3, 'assigned', 1, JSON.stringify({status:'available', assigned_to_user: null}), JSON.stringify({status:'in_use', assigned_to_user: 3}), 'Assigned to Priya Sharma');
        insertHistory.run(4, 'status_changed', 1, JSON.stringify({status:'in_use'}), JSON.stringify({status:'under_maintenance'}), 'Sent for battery replacement');
        insertHistory.run(12, 'assigned', 1, JSON.stringify({status:'available', assigned_to_user: null}), JSON.stringify({status:'in_use', assigned_to_user: 6}), 'Assigned to Vikram Singh');

        // Maintenance Schedules
        const insertMaint = db.prepare("INSERT INTO maintenance_schedules (id, asset_id, scheduled_date, maintenance_type, assigned_to, status, notes, completed_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        insertMaint.run(1, 1, getDateOffset(5), 'Preventive', 5, 'pending', 'Routine hardware checkup and OS update', null, 3);
        insertMaint.run(2, 7, getDateOffset(15), 'Repair', 6, 'pending', 'Scheduled vehicle servicing at 20k km', null, 1);
        insertMaint.run(3, 9, getDateOffset(-1), 'Inspection', 5, 'completed', 'Deep cleaning of printer heads and rollers', getDateOffset(-1), 3);

        // Tickets (with explicit created_at so resolution time calculations work correctly)
        const insertTicket = db.prepare("INSERT INTO tickets (id, ticket_number, asset_id, raised_by, assigned_to, issue_type, priority, title, description, status, resolved_at, closed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        insertTicket.run(1, 'TKT-2026-001', 2, 5, null, 'hardware_fault', 'high', 'Laptop screen flickering intermittently', 'MacBook Pro screen flickers when connected to external display. Issue started 2 days ago and is affecting productivity. Happens every 10-15 minutes.', 'open', null, null, getDateOffset(-1));
        insertTicket.run(2, 'TKT-2026-002', null, 6, 5, 'software', 'medium', 'Software installation request - VS Code & Docker', 'Need VS Code and Docker Desktop installed on my workstation for the new microservices project starting next week.', 'in_progress', null, null, getDateOffset(-3));
        insertTicket.run(3, 'TKT-2026-003', null, 7, null, 'access', 'critical', 'Network connectivity issues on Floor 2', 'Entire HR wing on Floor 2 has been experiencing intermittent network drops since this morning. Multiple team members affected. Urgent fix needed.', 'open', null, null, getDateOffset(0));
        insertTicket.run(4, 'TKT-2026-004', 3, 3, 5, 'hardware_fault', 'low', 'Keyboard replacement needed', 'HP Monitor keyboard has stuck keys (E and R). Need replacement under warranty.', 'resolved', getDateOffset(-2), null, getDateOffset(-7));
        insertTicket.run(5, 'TKT-2026-005', 9, 5, 6, 'hardware_fault', 'medium', 'Printer paper jam recurring', 'Canon printer in the print room jams every 20-30 pages. Already tried cleaning the rollers but issue persists.', 'closed', getDateOffset(-5), getDateOffset(-3), getDateOffset(-10));
        insertTicket.run(6, 'TKT-2026-006', null, 8, null, 'access', 'medium', 'VPN access request for remote work', 'Need VPN credentials and client setup for work-from-home arrangement approved by manager.', 'open', null, null, getDateOffset(-2));

        // Ticket Comments
        const insertComment = db.prepare("INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal) VALUES (?, ?, ?, ?)");
        insertComment.run(1, 3, 'Checked with Amit — screen issue is confirmed. Might need Apple service center visit. Will coordinate.', 0);
        insertComment.run(2, 5, 'Will install the software today. Docker requires admin rights, requesting elevated access.', 0);
        insertComment.run(2, 4, 'Admin access approved for software installation. Please complete by EOD.', 1);
        insertComment.run(4, 5, 'Replacement keyboard ordered from HP. ETA 3 business days. Using temporary USB keyboard in the meantime.', 0);
        insertComment.run(5, 6, 'Paper tray alignment was off. Fixed the alignment and replaced worn pickup rollers. Testing now.', 0);

        // Notifications
        const insertNotif = db.prepare("INSERT INTO notifications (user_id, type, title, message, reference_id, is_read) VALUES (?, ?, ?, ?, ?, ?)");
        insertNotif.run(5, 'ticket_assigned', 'Ticket Assigned to You', 'You have been assigned ticket TKT-2026-002: Software installation request', 2, 0);
        insertNotif.run(3, 'maintenance_due', 'Maintenance Schedule Created', 'Preventive maintenance scheduled for Dell XPS 15 Laptop', 1, 0);
        insertNotif.run(1, 'ticket_created', 'Critical Ticket Raised', 'A critical ticket has been raised: Network connectivity issues on Floor 2', 3, 0);
        insertNotif.run(6, 'ticket_updated', 'Ticket Status Updated', 'Ticket TKT-2026-004 has been marked as resolved', 4, 1);
        insertNotif.run(5, 'asset_assigned', 'Asset Assigned to You', 'MacBook Pro 16" has been assigned to you', 2, 1);

        // Audit Logs
        const insertAudit = db.prepare("INSERT INTO audit_logs (user_id, module, action, record_id, old_data, new_data) VALUES (?, ?, ?, ?, ?, ?)");
        insertAudit.run(1, 'asset', 'create', 1, null, JSON.stringify({name: 'Dell XPS 15 Laptop', status: 'available'}));
        insertAudit.run(1, 'asset', 'assign', 2, JSON.stringify({assigned_to_user: null, status: 'available'}), JSON.stringify({assigned_to_user: 5, status: 'in_use'}));
        insertAudit.run(5, 'ticket', 'create', 1, null, JSON.stringify({title: 'Laptop screen flickering intermittently', priority: 'high'}));
        insertAudit.run(1, 'maintenance', 'create', 1, null, JSON.stringify({asset_id: 1, maintenance_type: 'Preventive', status: 'pending'}));
    });

    seedTransaction();
    console.log('Seed data inserted successfully.');
}

// Helper to get ISO date offset from today
function getDateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

console.log('Database initialized at:', dbPath);
module.exports = db;