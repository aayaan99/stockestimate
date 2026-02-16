import React, { useMemo } from 'react';
import { calculateAll } from '../utils/calculations';
import TimelineView from './TimelineView';

export default function Dashboard({ chemicals, config }) {
  const result = useMemo(() => calculateAll(chemicals), [chemicals]);
  const { summary, chemicals: calcs, criticalItems, warningItems, gapItems } = result;

  /** Format ETAs for a chemical's imports */
  const formatEtas = (c) => {
    const imports = c.imports || [];
    const etas = imports.filter(i => i.eta).map(i => i.eta).sort();
    if (etas.length === 0) return '—';
    return etas.map(e => {
      const d = new Date(e + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }).join(', ');
  };

  return (
    <div className="dashboard-grid">
      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card total">
          <div className="number">{summary.total}</div>
          <div className="label">Total Chemicals</div>
        </div>
        <div className="summary-card critical">
          <div className="number">{summary.critical}</div>
          <div className="label">Critical (≤ 3 days)</div>
        </div>
        <div className="summary-card warning">
          <div className="number">{summary.warning}</div>
          <div className="label">Warning (≤ 10 days)</div>
        </div>
        <div className="summary-card low">
          <div className="number">{summary.low}</div>
          <div className="label">Low (≤ 20 days)</div>
        </div>
        <div className="summary-card ok">
          <div className="number">{summary.ok}</div>
          <div className="label">Adequate (&gt; 20 days)</div>
        </div>
        <div className="summary-card gaps">
          <div className="number">{summary.withGaps}</div>
          <div className="label">With Supply Gaps</div>
        </div>
      </div>

      {/* Alerts */}
      {(criticalItems.length > 0 || warningItems.length > 0 || gapItems.length > 0) && (
        <div className="card">
          <div className="card-header">
            <h2>⚠️ Procurement Alerts</h2>
          </div>
          <div className="card-body">
            <div className="alerts-list">
              {criticalItems.map(c => (
                <div key={c.id} className="alert-item critical">
                  <span className="alert-icon">🚨</span>
                  <div className="alert-content">
                    <strong>{c.name}</strong> — Only{' '}
                    <strong>{c.immediateDays.toFixed(1)} days</strong> of factory
                    stock remaining ({c.immediateStock.toLocaleString()} {c.unit})
                    <div className="detail">
                      Uses {c.usePerDay.toLocaleString()} {c.unit}/day • Total
                      stock covers {c.totalDays.toFixed(1)} days
                      {c.gapDays > 0 &&
                        ` • Gap of ${c.gapDays.toFixed(1)} days (need ${Math.ceil(c.gapQty).toLocaleString()} ${c.unit})`}
                    </div>
                  </div>
                </div>
              ))}
              {warningItems.map(c => (
                <div key={c.id} className="alert-item warning">
                  <span className="alert-icon">⚡</span>
                  <div className="alert-content">
                    <strong>{c.name}</strong> —{' '}
                    <strong>{c.immediateDays.toFixed(1)} days</strong> of factory
                    stock ({c.immediateStock.toLocaleString()} {c.unit})
                    <div className="detail">
                      Uses {c.usePerDay.toLocaleString()} {c.unit}/day • Total
                      stock covers {c.totalDays.toFixed(1)} days
                      {c.gapDays > 0 &&
                        ` • Gap of ${c.gapDays.toFixed(1)} days (need ${Math.ceil(c.gapQty).toLocaleString()} ${c.unit})`}
                    </div>
                  </div>
                </div>
              ))}
              {gapItems
                .filter(c => c.status !== 'critical' && c.status !== 'warning')
                .map(c => (
                  <div key={c.id} className="alert-item info">
                    <span className="alert-icon">📋</span>
                    <div className="alert-content">
                      <strong>{c.name}</strong> — Supply gap of{' '}
                      <strong>{c.gapDays.toFixed(1)} days</strong>
                      <div className="detail">
                        Need{' '}
                        <strong>
                          {Math.ceil(c.gapQty).toLocaleString()} {c.unit}
                        </strong>{' '}
                        local purchase to bridge the gap
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Procurement Recommendations Table */}
      {gapItems.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>🛒 Procurement Recommendations</h2>
          </div>
          <div className="card-body">
            <div className="table-wrapper">
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>Chemical</th>
                    <th className="number">Factory Days</th>
                    <th className="number">Gap (Days)</th>
                    <th className="number">Qty Needed</th>
                    <th>Import ETAs</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gapItems
                    .sort((a, b) => a.immediateDays - b.immediateDays)
                    .map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td className="number">{c.immediateDays.toFixed(1)}d</td>
                        <td className="number gap-qty">{c.gapDays.toFixed(1)}d</td>
                        <td className="number gap-qty">{Math.ceil(c.gapQty).toLocaleString()} {c.unit}</td>
                        <td style={{ fontSize: 12, color: 'var(--primary)' }}>{formatEtas(c)}</td>
                        <td>
                          <span className="badge badge-critical">Local Purchase</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Visual Timeline — preserves custom order */}
      <TimelineView chemicals={calcs} referenceDate={null} />

      {/* Quick Stock Summary Table — preserves custom order */}
      <div className="card">
        <div className="card-header">
          <h2>📊 Stock Overview</h2>
        </div>
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Chemical</th>
                  <th className="number">Factory Stock</th>
                  <th className="number">Import</th>
                  <th>ETAs</th>
                  <th className="number">Local Purch.</th>
                  <th className="number">Total</th>
                  <th className="number">Use/Day</th>
                  <th className="number">Factory Days</th>
                  <th className="number">Total Days</th>
                  <th className="number">Months</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {calcs.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td className="number">{c.factoryStock.toLocaleString()}</td>
                    <td className="number">{(c.totalImport || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: (c.imports || []).some(i => i.eta) ? 'var(--primary)' : '#94a3b8', maxWidth: 130, whiteSpace: 'normal', lineHeight: 1.4 }}>
                      {formatEtas(c)}
                    </td>
                    <td className="number">{(c.localPurchase || 0).toLocaleString()}</td>
                    <td className="number"><strong>{c.total.toLocaleString()}</strong></td>
                    <td className="number">{c.usePerDay.toLocaleString()}</td>
                    <td className="number">
                      {c.immediateDays === Infinity ? '—' : c.immediateDays.toFixed(1)}
                    </td>
                    <td className="number">
                      {c.totalDays === Infinity ? '—' : c.totalDays.toFixed(1)}
                    </td>
                    <td className="number">
                      {c.totalMonths === Infinity ? '—' : c.totalMonths.toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge badge-${c.status}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
