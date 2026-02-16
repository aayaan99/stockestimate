import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'data', 'stock-data.txt');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

/**
 * Migrate a single chemical from old format (import/importEta) to new (imports[])
 * Also updates unit to 'bags' if it was 'kg'
 */
function migrateChemical(c) {
  if (c.imports !== undefined) {
    // Already migrated, just update unit
    if (c.unit === 'kg') c.unit = 'bags';
    return c;
  }
  const imports = [];
  const oldQty = c['import'] || 0;
  const oldEta = c.importEta || null;
  if (oldQty > 0) {
    imports.push({ qty: oldQty, eta: oldEta, label: '' });
  }
  const migrated = { ...c, imports, unit: c.unit === 'kg' ? 'bags' : (c.unit || 'bags') };
  delete migrated['import'];
  delete migrated.importEta;
  return migrated;
}

function migrateData(data) {
  let changed = false;

  if (data.chemicals) {
    const migrated = data.chemicals.map(c => {
      const m = migrateChemical(c);
      if (m !== c || JSON.stringify(m) !== JSON.stringify(c)) changed = true;
      return m;
    });
    data.chemicals = migrated;
  }

  if (data.snapshots) {
    data.snapshots = data.snapshots.map(s => {
      if (!s.chemicals) return s;
      const migrated = s.chemicals.map(c => {
        const m = migrateChemical(c);
        if (m !== c || JSON.stringify(m) !== JSON.stringify(c)) changed = true;
        return m;
      });
      return { ...s, chemicals: migrated };
    });
  }

  return changed;
}

// Read data from file
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { config: { shifts: { EVA: 2, EVR: 2 } }, chemicals: [], snapshots: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading data file:', err.message);
    return { config: { shifts: { EVA: 2, EVR: 2 } }, chemicals: [], snapshots: [] };
  }
}

// Write data to file (atomic)
function writeData(data) {
  const tmpFile = DATA_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
}

// Auto-migrate on startup
(() => {
  const data = readData();
  const changed = migrateData(data);
  if (changed) {
    writeData(data);
    console.log('📦 Data migrated to new imports[] format with unit=bags');
  }
})();

// GET /api/data — return full data
app.get('/api/data', (req, res) => {
  const data = readData();
  res.json(data);
});

// PUT /api/data — update chemicals and config
app.put('/api/data', (req, res) => {
  const data = readData();
  if (req.body.chemicals !== undefined) data.chemicals = req.body.chemicals;
  if (req.body.config !== undefined) data.config = req.body.config;
  writeData(data);
  res.json({ success: true, data });
});

// POST /api/snapshot — save a snapshot of current state
app.post('/api/snapshot', (req, res) => {
  const data = readData();
  // Accept a custom date from the request body, or fall back to today
  const snapshotDate = req.body.date || new Date().toISOString().split('T')[0];

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  // Remove existing snapshot for that date if any
  data.snapshots = data.snapshots.filter(s => s.date !== snapshotDate);

  data.snapshots.push({
    date: snapshotDate,
    chemicals: JSON.parse(JSON.stringify(data.chemicals)),
    config: JSON.parse(JSON.stringify(data.config)),
  });

  // Keep only last 90 snapshots
  if (data.snapshots.length > 90) {
    data.snapshots = data.snapshots.slice(-90);
  }

  writeData(data);
  res.json({ success: true, date: snapshotDate });
});

// GET /api/snapshots — list snapshot dates
app.get('/api/snapshots', (req, res) => {
  const data = readData();
  const dates = (data.snapshots || []).map(s => s.date).sort().reverse();
  res.json(dates);
});

// GET /api/snapshot/:date — get a specific snapshot
app.get('/api/snapshot/:date', (req, res) => {
  const data = readData();
  const snapshot = (data.snapshots || []).find(s => s.date === req.params.date);
  if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
  res.json(snapshot);
});

// PUT /api/snapshot/:date — update a snapshot (edit chemicals in a snapshot)
app.put('/api/snapshot/:date', (req, res) => {
  const data = readData();
  const idx = (data.snapshots || []).findIndex(s => s.date === req.params.date);
  if (idx === -1) return res.status(404).json({ error: 'Snapshot not found' });

  if (req.body.chemicals !== undefined) data.snapshots[idx].chemicals = req.body.chemicals;
  if (req.body.config !== undefined) data.snapshots[idx].config = req.body.config;
  if (req.body.date !== undefined) data.snapshots[idx].date = req.body.date;

  writeData(data);
  res.json({ success: true, snapshot: data.snapshots[idx] });
});

// DELETE /api/snapshot/:date — delete a snapshot
app.delete('/api/snapshot/:date', (req, res) => {
  const data = readData();
  const before = data.snapshots.length;
  data.snapshots = (data.snapshots || []).filter(s => s.date !== req.params.date);
  if (data.snapshots.length === before) {
    return res.status(404).json({ error: 'Snapshot not found' });
  }
  writeData(data);
  res.json({ success: true });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`✅ StockEstimate server running on http://localhost:${PORT}`);
  console.log(`📁 Data file: ${DATA_FILE}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️  Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
    app.listen(PORT + 1, () => {
      console.log(`✅ StockEstimate server running on http://localhost:${PORT + 1}`);
      console.log(`📁 Data file: ${DATA_FILE}`);
      console.log(`⚡ Note: Update vite.config.js proxy target if using dev mode on this port.`);
    });
  } else {
    throw err;
  }
});
