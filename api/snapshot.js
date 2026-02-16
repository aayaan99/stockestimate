/** POST /api/snapshot — save a snapshot of current state */
import { readData, writeData } from './_storage.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const data = await readData();
      const snapshotDate = req.body.date || new Date().toISOString().split('T')[0];

      if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      }

      data.snapshots = (data.snapshots || []).filter(s => s.date !== snapshotDate);
      data.snapshots.push({
        date: snapshotDate,
        chemicals: JSON.parse(JSON.stringify(data.chemicals)),
        config: JSON.parse(JSON.stringify(data.config)),
      });

      if (data.snapshots.length > 90) {
        data.snapshots = data.snapshots.slice(-90);
      }

      await writeData(data);
      return res.json({ success: true, date: snapshotDate });
    } catch (err) {
      console.error('Snapshot save error:', err);
      return res.status(500).json({ error: err.message || 'Failed to save snapshot' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
