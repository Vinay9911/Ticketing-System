const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'vinayai',
    database: 'asset_ticketing_db',
    port: 5432
});

async function resetDB() {
    try {
        console.log('Dropping all ts_ tables...');
        await pool.query(`
            DROP TABLE IF EXISTS ts_audit_logs CASCADE;
            DROP TABLE IF EXISTS ts_notifications CASCADE;
            DROP TABLE IF EXISTS ts_ticket_comments CASCADE;
            DROP TABLE IF EXISTS ts_tickets CASCADE;
            DROP TABLE IF EXISTS ts_maintenance_schedules CASCADE;
            DROP TABLE IF EXISTS ts_asset_history CASCADE;
            DROP TABLE IF EXISTS ts_assets CASCADE;
            DROP TABLE IF EXISTS ts_asset_categories CASCADE;
            DROP TABLE IF EXISTS ts_users CASCADE;
            DROP TABLE IF EXISTS ts_departments CASCADE;
        `);
        console.log('All tables dropped successfully.');
    } catch (err) {
        console.error('Error dropping tables:', err.message);
    } finally {
        await pool.end();
    }
}

resetDB();
