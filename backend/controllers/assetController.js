const db = require('../config/db');

exports.getAssets = (req, res) => {
    db.all("SELECT * FROM assets ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ assets: rows });
    });
};

exports.createAsset = (req, res) => {
    const { name, category } = req.body;
    const sql = `INSERT INTO assets (name, category) VALUES (?, ?)`;
    
    db.run(sql, [name, category], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Asset created", id: this.lastID });
    });
};