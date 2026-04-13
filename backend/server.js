const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database (creates tables + seeds on first run)
const db = require('./config/db');

// Import routes
const assetRoutes = require('./routes/assetRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// ─── Health Check ────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Asset Management & Ticketing System API is running', timestamp: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────────────────
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/users', userRoutes);

// ─── Login endpoint (returns user data for simulated auth) ──
app.get('/api/v1/auth/users', (req, res) => {
    const users = db.prepare(`
        SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
        FROM users u LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.is_active = 1 ORDER BY u.role, u.name
    `).all();
    res.json({ users });
});

// ─── Global Error Handler ────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n  ✅ Server running at http://localhost:${PORT}`);
    console.log(`  📦 API Base: http://localhost:${PORT}/api/v1`);
    console.log(`  🌐 Frontend: http://localhost:${PORT}\n`);
});