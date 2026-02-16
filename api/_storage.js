/**
 * Vercel Blob storage utility for StockEstimate
 * Replaces the local filesystem (data/stock-data.txt) for production.
 */
import { put, list } from '@vercel/blob';

const BLOB_KEY = 'stock-data.json';

const DEFAULT_DATA = {
  config: { shifts: { EVA: 2, EVR: 2 } },
  chemicals: [],
  snapshots: [],
};

/** Migrate old single-import format to new imports[] array */
function migrateChemical(c) {
  if (c.imports !== undefined) {
    if (c.unit === 'kg') c.unit = 'bags';
    return c;
  }
  const imports = [];
  const oldQty = c['import'] || 0;
  const oldEta = c.importEta || null;
  if (oldQty > 0) imports.push({ qty: oldQty, eta: oldEta, label: '' });
  const migrated = { ...c, imports, unit: c.unit === 'kg' ? 'bags' : (c.unit || 'bags') };
  delete migrated['import'];
  delete migrated.importEta;
  return migrated;
}

function migrateData(data) {
  if (data.chemicals) {
    data.chemicals = data.chemicals.map(migrateChemical);
  }
  if (data.snapshots) {
    data.snapshots = data.snapshots.map(s => ({
      ...s,
      chemicals: (s.chemicals || []).map(migrateChemical),
    }));
  }
  return data;
}

/** Read data from Vercel Blob */
export async function readData() {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (blobs.length === 0) return { ...DEFAULT_DATA };
    const res = await fetch(blobs[0].url);
    if (!res.ok) return { ...DEFAULT_DATA };
    const data = await res.json();
    return migrateData(data);
  } catch (err) {
    console.error('Blob read error:', err.message);
    return { ...DEFAULT_DATA };
  }
}

/** Write data to Vercel Blob (overwrites) */
export async function writeData(data) {
  await put(BLOB_KEY, JSON.stringify(data, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}
