/** GET/PUT/DELETE /api/snapshot/:date — manage a specific snapshot */
import { readData, writeData } from '../_storage.js';

export default async function handler(req, res) {
  const { date } = req.query;

  if (req.method === 'GET') {
    const data = await readData();
    const snapshot = (data.snapshots || []).find(s => s.date === date);
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
    return res.json(snapshot);
  }

  if (req.method === 'PUT') {
    const data = await readData();
    const idx = (data.snapshots || []).findIndex(s => s.date === date);
    if (idx === -1) return res.status(404).json({ error: 'Snapshot not found' });

    if (req.body.chemicals !== undefined) data.snapshots[idx].chemicals = req.body.chemicals;
    if (req.body.config !== undefined) data.snapshots[idx].config = req.body.config;
    if (req.body.date !== undefined) data.snapshots[idx].date = req.body.date;

    await writeData(data);
    return res.json({ success: true, snapshot: data.snapshots[idx] });
  }

  if (req.method === 'DELETE') {
    const data = await readData();
    const before = (data.snapshots || []).length;
    data.snapshots = (data.snapshots || []).filter(s => s.date !== date);
    if (data.snapshots.length === before) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    await writeData(data);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
