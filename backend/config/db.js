const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Creates a local.db file in the root of your project
const dbPath = path.resolve(__dirname, '../../local.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to local SQLite database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // 1. Departments
        db.run(`CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Users (Synced from main app context)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            role TEXT CHECK( role IN ('admin', 'manager', 'staff') ) NOT NULL,
            department_id INTEGER,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id)
        )`);

        // 3. Asset Categories
        db.run(`CREATE TABLE IF NOT EXISTS asset_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT
        )`);

        // 4. Assets
        db.run(`CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category_id INTEGER,
            serial_number TEXT UNIQUE,
            purchase_date DATE,
            cost DECIMAL(12,2),
            warranty_expiry DATE,
            location TEXT,
            status TEXT CHECK( status IN ('available', 'in_use', 'under_maintenance', 'retired') ) DEFAULT 'available',
            assigned_to_user INTEGER,
            assigned_to_dept INTEGER,
            notes TEXT,
            is_deleted BOOLEAN DEFAULT 0,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES asset_categories(id),
            FOREIGN KEY (assigned_to_user) REFERENCES users(id),
            FOREIGN KEY (assigned_to_dept) REFERENCES departments(id)
        )`);

        // 5. Asset History
        db.run(`CREATE TABLE IF NOT EXISTS asset_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER,
            action_type TEXT NOT NULL,
            performed_by INTEGER,
            previous_value TEXT,
            new_value TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (asset_id) REFERENCES assets(id),
            FOREIGN KEY (performed_by) REFERENCES users(id)
        )`);

        // 6. Maintenance Schedules
        db.run(`CREATE TABLE IF NOT EXISTS maintenance_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER,
            scheduled_date DATE NOT NULL,
            maintenance_type TEXT,
            assigned_to INTEGER,
            status TEXT CHECK( status IN ('pending', 'completed', 'overdue') ) DEFAULT 'pending',
            notes TEXT,
            completed_at DATETIME,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (asset_id) REFERENCES assets(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )`);

        // 7. Tickets
        db.run(`CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_number TEXT UNIQUE NOT NULL,
            asset_id INTEGER,
            raised_by INTEGER NOT NULL,
            assigned_to INTEGER,
            issue_type TEXT NOT NULL,
            priority TEXT CHECK( priority IN ('low', 'medium', 'high', 'critical') ) NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT CHECK( status IN ('open', 'in_progress', 'resolved', 'closed') ) DEFAULT 'open',
            attachments TEXT,
            resolved_at DATETIME,
            closed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (asset_id) REFERENCES assets(id),
            FOREIGN KEY (raised_by) REFERENCES users(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )`);

        // 8. Ticket Comments
        db.run(`CREATE TABLE IF NOT EXISTS ticket_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER,
            user_id INTEGER,
            comment TEXT NOT NULL,
            is_internal BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // 9. Notifications
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            reference_id INTEGER,
            is_read BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // 10. Audit Logs
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            module TEXT NOT NULL,
            action TEXT NOT NULL,
            record_id INTEGER NOT NULL,
            old_data TEXT,
            new_data TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        seedInitialData();
    });
}

function seedInitialData() {
    // Insert a dummy department and 3 dummy users so you can log in and test immediately
    db.run(`INSERT OR IGNORE INTO departments (id, name) VALUES (1, 'IT Department')`);
    db.run(`INSERT OR IGNORE INTO users (id, name, email, role, department_id) VALUES (1, 'Admin User', 'admin@company.com', 'admin', 1)`);
    db.run(`INSERT OR IGNORE INTO users (id, name, email, role, department_id) VALUES (2, 'Manager User', 'manager@company.com', 'manager', 1)`);
    db.run(`INSERT OR IGNORE INTO users (id, name, email, role, department_id) VALUES (3, 'Staff User', 'staff@company.com', 'staff', 1)`);
}

module.exports = db;