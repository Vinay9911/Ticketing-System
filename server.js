const express = require('express');
const path = require('path');
const fs = require('fs');

// Initialize database (creates tables on first run)
const { initializeDatabase } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── Middleware ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static assets from /public (accessed via /ticketing/...)
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// ─── Health Check ────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Asset Management & Ticketing System API is running', timestamp: new Date().toISOString() });
});

// ─── API Routes (all under /api/ticketing) ───────────────
app.use('/api/ticketing', require('./routes/ticketingModule'));

// ─── Serve SPA ───────────────────────────────────────────
// All non-API routes serve the SPA's index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ─── Global Error Handler ────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────
async function start() {
    try {
        await initializeDatabase();
        app.listen(PORT, () => {
            console.log(`\n  ✅ Server running at http://localhost:${PORT}`);
            console.log(`  📦 API Base: http://localhost:${PORT}/api/ticketing`);
            console.log(`  🌐 Frontend: http://localhost:${PORT}\n`);
        });
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
}

start();