const { Pool } = require('pg');

// ─── PostgreSQL Connection Pool ──────────────────────────
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWD || 'vinayai',
    database: process.env.DB_NAME || 'asset_ticketing_db',
    port: parseInt(process.env.DB_PORT) || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

// ─── Schema Initialization ──────────────────────────────
const initSQL = `
    CREATE TABLE IF NOT EXISTS ts_departments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ts_users (
        id SERIAL PRIMARY KEY,
        emp_id TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT CHECK(role IN ('admin','manager','staff')) NOT NULL,
        department_id INTEGER REFERENCES ts_departments(id),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ts_asset_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS ts_assets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES ts_asset_categories(id),
        serial_number TEXT UNIQUE,
        express_service_code TEXT,
        make_model TEXT,
        purchase_date DATE,
        cost NUMERIC(12,2),
        warranty_start_date DATE,
        warranty_expiry DATE,
        location TEXT,
        status TEXT CHECK(status IN ('available','in_use','under_maintenance','retired')) DEFAULT 'available',
        assigned_to_user INTEGER REFERENCES ts_users(id),
        assigned_to_dept INTEGER REFERENCES ts_departments(id),
        notes TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_by INTEGER REFERENCES ts_users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ts_asset_history (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER REFERENCES ts_assets(id),
        action_type TEXT NOT NULL,
        performed_by INTEGER REFERENCES ts_users(id),
        previous_value TEXT,
        new_value TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ts_repairs (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER REFERENCES ts_assets(id),
        repair_date DATE NOT NULL,
        issue_description TEXT NOT NULL,
        assigned_to INTEGER REFERENCES ts_users(id),
        status TEXT CHECK(status IN ('scheduled','pending','in_progress','completed','cancelled')) DEFAULT 'scheduled',
        cost NUMERIC(12,2),
        provider TEXT,
        invoice_path TEXT,
        requires_approval BOOLEAN DEFAULT FALSE,
        is_approved BOOLEAN DEFAULT FALSE,
        approved_by INTEGER REFERENCES ts_users(id),
        notes TEXT,
        completed_at TIMESTAMPTZ,
        created_by INTEGER REFERENCES ts_users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ts_tickets (
        id SERIAL PRIMARY KEY,
        ticket_number TEXT UNIQUE NOT NULL,
        asset_id INTEGER REFERENCES ts_assets(id),
        raised_by INTEGER NOT NULL REFERENCES ts_users(id),
        assigned_to INTEGER REFERENCES ts_users(id),
        issue_type TEXT NOT NULL,
        priority TEXT CHECK(priority IN ('low','medium','high','critical')) NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT CHECK(status IN ('open','in_progress','resolved','closed')) DEFAULT 'open',
        attachments TEXT,
        resolved_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ts_ticket_comments (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES ts_tickets(id),
        user_id INTEGER REFERENCES ts_users(id),
        comment TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ts_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES ts_users(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        reference_id INTEGER,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ts_audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES ts_users(id),
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        old_data TEXT,
        new_data TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- THE MISSING MAINTENANCE TABLE HAS BEEN ADDED HERE
    CREATE TABLE IF NOT EXISTS ts_maintenance_schedules (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER REFERENCES ts_assets(id),
        scheduled_date DATE NOT NULL,
        maintenance_type TEXT NOT NULL,
        assigned_to INTEGER REFERENCES ts_users(id),
        status TEXT CHECK(status IN ('pending', 'completed', 'overdue', 'cancelled')) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
`;

// ─── Run ALTER TABLE statements safely for existing deployments ───
const alterSQL = `
    DO $$
    BEGIN
        -- Add provider column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ts_repairs' AND column_name = 'provider'
        ) THEN
            ALTER TABLE ts_repairs ADD COLUMN provider TEXT;
        END IF;

        -- Drop and re-add status constraint to include 'scheduled'
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'ts_repairs' AND constraint_type = 'CHECK'
        ) THEN
            BEGIN
                ALTER TABLE ts_repairs DROP CONSTRAINT IF EXISTS ts_repairs_status_check;
                ALTER TABLE ts_repairs ADD CONSTRAINT ts_repairs_status_check
                    CHECK (status IN ('scheduled','pending','in_progress','completed','cancelled'));
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END IF;

        -- Add express_service_code to ts_assets if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ts_assets' AND column_name = 'express_service_code'
        ) THEN
            ALTER TABLE ts_assets ADD COLUMN express_service_code TEXT;
        END IF;

        -- Add make_model to ts_assets if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ts_assets' AND column_name = 'make_model'
        ) THEN
            ALTER TABLE ts_assets ADD COLUMN make_model TEXT;
        END IF;

        -- Add warranty_start_date to ts_assets if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'ts_assets' AND column_name = 'warranty_start_date'
        ) THEN
            ALTER TABLE ts_assets ADD COLUMN warranty_start_date DATE;
        END IF;
    END
    $$;
`;

const indexSQL = `
    CREATE INDEX IF NOT EXISTS idx_ts_assets_status ON ts_assets(status);
    CREATE INDEX IF NOT EXISTS idx_ts_assets_category ON ts_assets(category_id);
    CREATE INDEX IF NOT EXISTS idx_ts_assets_assigned_user ON ts_assets(assigned_to_user);
    CREATE INDEX IF NOT EXISTS idx_ts_assets_assigned_dept ON ts_assets(assigned_to_dept);
    CREATE INDEX IF NOT EXISTS idx_ts_assets_deleted ON ts_assets(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_ts_asset_history_asset ON ts_asset_history(asset_id);
    CREATE INDEX IF NOT EXISTS idx_ts_repairs_asset ON ts_repairs(asset_id);
    CREATE INDEX IF NOT EXISTS idx_ts_repairs_status ON ts_repairs(status);
    CREATE INDEX IF NOT EXISTS idx_ts_tickets_status ON ts_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_ts_tickets_priority ON ts_tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_ts_tickets_raised_by ON ts_tickets(raised_by);
    CREATE INDEX IF NOT EXISTS idx_ts_tickets_assigned_to ON ts_tickets(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_ts_ticket_comments_ticket ON ts_ticket_comments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ts_notifications_user ON ts_notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_ts_notifications_read ON ts_notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_ts_audit_logs_module ON ts_audit_logs(module);
    CREATE INDEX IF NOT EXISTS idx_ts_audit_logs_user ON ts_audit_logs(user_id);
    
    -- THE MISSING MAINTENANCE INDEX HAS BEEN ADDED HERE
    CREATE INDEX IF NOT EXISTS idx_ts_maintenance_asset ON ts_maintenance_schedules(asset_id);
`;

// Initialize schema on first import
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(initSQL);
        await client.query(alterSQL);
        await client.query(indexSQL);
        console.log('✅ PostgreSQL schema initialized (ts_ prefixed tables)');
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, initializeDatabase };