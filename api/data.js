/** GET /api/data — return full data | PUT /api/data — update chemicals/config */
import { readData, writeData } from './_storage.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await readData();
    return res.json(data);
  }

  if (req.method === 'PUT') {
    const data = await readData();
    if (req.body.chemicals !== undefined) data.chemicals = req.body.chemicals;
    if (req.body.config !== undefined) data.config = req.body.config;
    await writeData(data);
    return res.json({ success: true, data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
