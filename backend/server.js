const express = require('express');
const cors = require('cors');
const db = require('./config/db'); 
const assetRoutes = require('./routes/assetRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// Mount Routes matching the PDF Base URL /api/v1 [cite: 77]
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/tickets', ticketRoutes);

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});