/**
 * POST /api/seed — One-time endpoint to upload local data to Vercel Blob.
 * Send your stock-data.txt contents as the request body.
 * 
 * Usage (after deploy):
 *   curl -X POST https://your-app.vercel.app/api/seed \
 *     -H "Content-Type: application/json" \
 *     -d @data/stock-data.txt
 */
import { writeData, readData } from './_storage.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const body = req.body;

    if (!body || !body.chemicals) {
      return res.status(400).json({
        error: 'Invalid data. Send the contents of stock-data.txt as JSON body.',
      });
    }

    // Check if data already exists
    const existing = await readData();
    if (existing.chemicals && existing.chemicals.length > 0) {
      return res.status(409).json({
        error: 'Data already exists in blob storage. Delete it first or use PUT /api/data.',
        existingCount: existing.chemicals.length,
      });
    }

    await writeData(body);
    return res.json({
      success: true,
      message: `Seeded ${body.chemicals.length} chemicals and ${(body.snapshots || []).length} snapshots.`,
    });
  }

  if (req.method === 'GET') {
    return res.json({
      message: 'POST your data/stock-data.txt contents to this endpoint to seed the database.',
      usage: 'curl -X POST https://your-app.vercel.app/api/seed -H "Content-Type: application/json" -d @data/stock-data.txt',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
