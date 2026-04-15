const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'vinayai',
    database: 'asset_ticketing_db',
    port: 5432
});

async function seed() {
    try {
        await pool.query(`
            INSERT INTO ts_departments (name) VALUES 
                ('IT Department'), ('Human Resources'), ('Finance'), ('Operations')
            ON CONFLICT (name) DO NOTHING
        `);

        await pool.query(`
            INSERT INTO ts_users (emp_id, name, email, role, department_id) VALUES
                ('EMP001', 'Admin User', 'admin@test.com', 'admin', 1),
                ('EMP002', 'Manager User', 'manager@test.com', 'manager', 1),
                ('EMP003', 'Staff User', 'staff@test.com', 'staff', 1)
            ON CONFLICT (email) DO NOTHING
        `);

        await pool.query(`
            INSERT INTO ts_asset_categories (name, description) VALUES
                ('IT Equipment', 'Laptops, monitors, printers, networking gear'),
                ('Furniture', 'Desks, chairs, cabinets, shelves'),
                ('Vehicles', 'Company cars, vans, delivery vehicles'),
                ('Software Licenses', 'Operating systems, productivity suites')
            ON CONFLICT (name) DO NOTHING
        `);

        console.log('✅ Seed data inserted successfully');
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
