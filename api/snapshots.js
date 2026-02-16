/** GET /api/snapshots — list snapshot dates */
import { readData } from './_storage.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await readData();
    const dates = (data.snapshots || []).map(s => s.date).sort().reverse();
    return res.json(dates);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
