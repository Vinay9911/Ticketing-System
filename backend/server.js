const express = require('express');
const cors = require('cors');
const ticketRoutes = require('./routes/ticketRoutes');
const assetRoutes = require('./routes/assetRoutes'); // ADD THIS

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/tickets', ticketRoutes);
app.use('/api/assets', assetRoutes); // ADD THIS

app.listen(3000, () => console.log(`Backend running on http://localhost:3000`));