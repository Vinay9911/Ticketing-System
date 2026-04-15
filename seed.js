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
        console.log('🌱 Starting database seeding for showcase...');

        // 1. Departments
        await pool.query(`
            INSERT INTO ts_departments (id, name) VALUES 
                (1, 'IT Department'), (2, 'Human Resources'), (3, 'Finance'), (4, 'Operations')
            ON CONFLICT (name) DO NOTHING;
        `);

        // 2. Users (Admin, Manager, Staff)
        await pool.query(`
            INSERT INTO ts_users (id, emp_id, name, email, role, department_id) VALUES
                (1, 'EMP001', 'Admin User', 'admin@test.com', 'admin', 1),
                (2, 'EMP002', 'IT Manager', 'manager@test.com', 'manager', 1),
                (3, 'EMP003', 'Staff User', 'staff@test.com', 'staff', 2),
                (4, 'EMP004', 'Finance Manager', 'finance@test.com', 'manager', 3),
                (5, 'EMP005', 'Ops Staff', 'ops@test.com', 'staff', 4)
            ON CONFLICT (email) DO NOTHING;
        `);

        // 3. Asset Categories
        await pool.query(`
            INSERT INTO ts_asset_categories (id, name, description) VALUES
                (1, 'IT Equipment', 'Laptops, monitors, networking gear'),
                (2, 'Furniture', 'Desks, ergonomic chairs'),
                (3, 'Vehicles', 'Company cars, delivery vans')
            ON CONFLICT (name) DO NOTHING;
        `);

        // 4. Assets (Mix of Available, In Use, and Maintenance)
        await pool.query(`
            INSERT INTO ts_assets (id, name, category_id, serial_number, make_model, purchase_date, cost, status, assigned_to_user, location) VALUES
                (1, 'MacBook Pro 16"', 1, 'SN-MAC-001', 'Apple M2 Pro', '2023-01-15', 220000, 'in_use', 3, 'HR Block, Desk 12'),
                (2, 'Dell XPS 15', 1, 'SN-DELL-002', 'Dell XPS 9520', '2023-06-10', 180000, 'in_use', 2, 'IT Room'),
                (3, 'ErgoChair Pro', 2, 'FURN-CH-001', 'Autonomous', '2022-11-05', 35000, 'available', NULL, 'Storage Room A'),
                (4, 'ThinkPad T14', 1, 'SN-LEN-003', 'Lenovo ThinkPad', '2024-01-20', 120000, 'under_maintenance', NULL, 'IT Repair Lab'),
                (5, 'Company Swift', 3, 'VEH-CAR-001', 'Maruti Suzuki', '2021-05-15', 850000, 'available', NULL, 'Basement Parking')
            ON CONFLICT (serial_number) DO NOTHING;
        `);

        // 5. Asset History
        await pool.query(`
            INSERT INTO ts_asset_history (asset_id, action_type, performed_by, previous_value, new_value, notes) VALUES
                (1, 'assigned', 1, '{"status":"available"}', '{"status":"in_use"}', 'Assigned to new HR staff'),
                (4, 'status_changed', 2, '{"status":"available"}', '{"status":"under_maintenance"}', 'Screen flickering issue reported')
        `);

        // 6. Tickets (Showcasing Open, In Progress, and Resolved)
        await pool.query(`
            INSERT INTO ts_tickets (id, ticket_number, asset_id, raised_by, assigned_to, issue_type, priority, title, description, status) VALUES
                (1, 'TKT-2024-001', 1, 3, 2, 'hardware', 'high', 'MacBook Battery Draining Fast', 'The battery lasts only 2 hours after full charge.', 'in_progress'),
                (2, 'TKT-2024-002', NULL, 5, NULL, 'software', 'medium', 'Need MS Office Access', 'Please grant me access to the company Office 365 account.', 'open'),
                (3, 'TKT-2024-003', 2, 2, 1, 'hardware', 'low', 'Mouse acting weird', 'The scroll wheel on my provided mouse is jumping.', 'resolved')
            ON CONFLICT (ticket_number) DO NOTHING;
        `);

        // 7. Ticket Comments
        await pool.query(`
            INSERT INTO ts_ticket_comments (ticket_id, user_id, comment, is_internal) VALUES
                (1, 2, 'I will order a replacement battery. Should take 2 days.', false),
                (1, 1, 'Approving the battery purchase budget.', true),
                (3, 1, 'Provided a new mouse from inventory. Closing ticket.', false)
        `);

        // 8. Repairs
        await pool.query(`
            INSERT INTO ts_repairs (asset_id, repair_date, issue_description, assigned_to, status, cost, provider, requires_approval, is_approved) VALUES
                (4, CURRENT_DATE + INTERVAL '2 days', 'Replace broken screen', 1, 'scheduled', 15000, 'Lenovo Care', true, false),
                (5, CURRENT_DATE - INTERVAL '10 days', 'Annual Servicing & Oil Change', 5, 'completed', 8500, 'Maruti Service Center', false, true)
        `);

        // 9. Maintenance Schedules
        await pool.query(`
            INSERT INTO ts_maintenance_schedules (asset_id, scheduled_date, maintenance_type, assigned_to, status, notes) VALUES
                (2, CURRENT_DATE + INTERVAL '15 days', 'Preventive', 1, 'pending', '{"userNotes":"Routine IT checkup"}'),
                (5, CURRENT_DATE - INTERVAL '2 days', 'Inspection', 5, 'overdue', '{"userNotes":"Check tyre pressure and battery"}')
        `);

        // 10. Notifications (To make the bell icon light up!)
        await pool.query(`
            INSERT INTO ts_notifications (user_id, type, title, message, reference_id, is_read) VALUES
                (1, 'ticket_created', 'New Ticket Raised', 'Ops Staff raised: Need MS Office Access', 2, false),
                (2, 'ticket_assigned', 'Ticket Assigned to You', 'Ticket TKT-2024-001 has been assigned to you', 1, false),
                (3, 'comment_added', 'New Comment on Your Ticket', 'IT Manager commented on TKT-2024-001', 1, true)
        `);

        // Update sequences so new inserts don't fail with ID collisions
        await pool.query(`
            SELECT setval('ts_departments_id_seq', (SELECT MAX(id) FROM ts_departments));
            SELECT setval('ts_users_id_seq', (SELECT MAX(id) FROM ts_users));
            SELECT setval('ts_asset_categories_id_seq', (SELECT MAX(id) FROM ts_asset_categories));
            SELECT setval('ts_assets_id_seq', (SELECT MAX(id) FROM ts_assets));
            SELECT setval('ts_tickets_id_seq', (SELECT MAX(id) FROM ts_tickets));
        `);

        console.log('✅ Showcase data injected successfully! You can now log in and demo the app.');
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        await pool.end();
    }
}

seed();