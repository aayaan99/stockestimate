/**
 * Core calculation utilities for StockEstimate
 */

export function diffInDays(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Migrate old single-import format to new imports[] array format
 */
export function migrateChemical(chem) {
  if (chem.imports !== undefined) return chem;
  const imports = [];
  const oldQty = chem['import'] || 0;
  const oldEta = chem.importEta || null;
  if (oldQty > 0) {
    imports.push({ qty: oldQty, eta: oldEta, label: '' });
  }
  // Remove old fields, add new
  const migrated = { ...chem, imports };
  delete migrated['import'];
  delete migrated.importEta;
  return migrated;
}

/**
 * Calculate all derived values for a chemical
 */
export function calculateChemical(chem, today = todayStr()) {
  const c = migrateChemical(chem);
  const usePerDay = c.usePerDay || 0;
  const imports = c.imports || [];
  const totalImport = imports.reduce((sum, i) => sum + (i.qty || 0), 0);

  const factoryStock = c.factoryStock || 0;
  const localPurchase = c.localPurchase || 0;
  const total = factoryStock + totalImport + localPurchase;
  const immediateStock = factoryStock + localPurchase;
  const unit = c.unit || 'bags';

  if (usePerDay === 0) {
    return {
      ...c,
      totalImport,
      total,
      immediateStock,
      immediateDays: Infinity,
      totalDays: Infinity,
      totalMonths: Infinity,
      status: 'ok',
      gapDays: 0,
      gapQty: 0,
      timeline: [],
    };
  }

  const immediateDays = immediateStock / usePerDay;

  // Build timeline segments
  const timeline = [];
  let cursor = 0; // days from reference date

  // Segment 1: Factory + Local Purchase (available immediately)
  if (immediateStock > 0) {
    timeline.push({
      type: 'factory',
      label: `Factory + Local (${immediateStock.toLocaleString()} ${unit})`,
      startDay: 0,
      endDay: immediateDays,
      days: immediateDays,
      qty: immediateStock,
    });
    cursor = immediateDays;
  }

  // Segment 2+: Multiple imports
  let totalGapDays = 0;
  let totalGapQty = 0;

  // Sort: imports with ETA first (earliest first), then without ETA
  const withEta = imports
    .filter(i => (i.qty || 0) > 0 && i.eta)
    .sort((a, b) => a.eta.localeCompare(b.eta));
  const withoutEta = imports.filter(i => (i.qty || 0) > 0 && !i.eta);
  const sortedImports = [...withEta, ...withoutEta];

  for (let idx = 0; idx < sortedImports.length; idx++) {
    const imp = sortedImports[idx];
    const importDays = imp.qty / usePerDay;
    const shipLabel = imp.label || `Import ${idx + 1}`;

    if (imp.eta) {
      const etaDaysFromNow = diffInDays(today, imp.eta);
      const etaDay = Math.max(0, etaDaysFromNow);

      if (cursor < etaDay) {
        // There's a GAP between current stock running out and this import arriving
        const gapDays = etaDay - cursor;
        const gapQty = gapDays * usePerDay;
        totalGapDays += gapDays;
        totalGapQty += gapQty;
        timeline.push({
          type: 'gap',
          label: `GAP — Need ${Math.ceil(gapQty).toLocaleString()} ${unit} (before ${shipLabel})`,
          startDay: cursor,
          endDay: etaDay,
          days: gapDays,
          qty: gapQty,
        });
        cursor = etaDay;
      }
      // Import segment
      timeline.push({
        type: 'import',
        label: `${shipLabel} (${imp.qty.toLocaleString()} ${unit}) — ETA: ${imp.eta}`,
        startDay: cursor,
        endDay: cursor + importDays,
        days: importDays,
        qty: imp.qty,
        eta: imp.eta,
      });
      cursor += importDays;
    } else {
      // No ETA — import follows after previous stock
      timeline.push({
        type: 'import',
        label: `${shipLabel} (${imp.qty.toLocaleString()} ${unit}) — No ETA`,
        startDay: cursor,
        endDay: cursor + importDays,
        days: importDays,
        qty: imp.qty,
        eta: null,
      });
      cursor += importDays;
    }
  }

  const totalDays = total / usePerDay;
  const totalMonths = totalDays / 30;

  // Status classification
  let status = 'ok';
  if (immediateDays <= 3) status = 'critical';
  else if (immediateDays <= 10) status = 'warning';
  else if (immediateDays <= 20) status = 'low';

  // If there are gaps, bump status
  if (totalGapDays > 0 && status === 'ok') status = 'warning';

  return {
    ...c,
    totalImport,
    total,
    immediateStock,
    immediateDays,
    totalDays,
    totalMonths,
    status,
    gapDays: totalGapDays,
    gapQty: totalGapQty,
    timeline,
    timelineEndDay: cursor,
  };
}

/**
 * Calculate all chemicals and return summary
 * Preserves original array order.
 */
export function calculateAll(chemicals, today = todayStr()) {
  const calculated = chemicals.map(c => calculateChemical(c, today));

  const critical = calculated.filter(c => c.status === 'critical');
  const warning = calculated.filter(c => c.status === 'warning');
  const low = calculated.filter(c => c.status === 'low');
  const ok = calculated.filter(c => c.status === 'ok');
  const withGaps = calculated.filter(c => c.gapDays > 0);

  return {
    chemicals: calculated,
    summary: {
      total: calculated.length,
      critical: critical.length,
      warning: warning.length,
      low: low.length,
      ok: ok.length,
      withGaps: withGaps.length,
    },
    criticalItems: critical,
    warningItems: warning,
    gapItems: withGaps,
  };
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return 'chem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/**
 * Create an empty chemical template
 */
export function emptyChemical() {
  return {
    id: generateId(),
    name: '',
    category: 'Chemical',
    factoryStock: 0,
    imports: [],
    localPurchase: 0,
    usePerDay: 0,
    unit: 'bags',
    notes: '',
    lastUpdated: todayStr(),
  };
}

/**
 * Create an empty import entry
 */
export function emptyImport() {
  return { qty: 0, eta: null, label: '' };
}
