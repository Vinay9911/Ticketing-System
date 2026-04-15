const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'postgres', password:'vinayai', database:'asset_ticketing_db', port:5432 });
pool.query("INSERT INTO ts_assets (name, category_id, serial_number, make_model, warranty_start_date, warranty_expiry) VALUES ('Mock Laptop', 1, 'LAP12345', 'Dell Latitude', '2023-01-01', '2026-01-01') ON CONFLICT DO NOTHING")
  .then(()=>console.log('Done'))
  .catch(console.error)
  .finally(()=>pool.end());
