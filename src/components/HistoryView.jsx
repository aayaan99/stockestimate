import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { calculateAll } from '../utils/calculations';
import TimelineView from './TimelineView';
import ChemicalForm from './ChemicalForm';

const API = '/api';

export default function HistoryView({ toast }) {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editChem, setEditChem] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const loadDates = useCallback(async () => {
    try {
      const res = await fetch(`${API}/snapshots`);
      const data = await res.json();
      setDates(data);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDates(); }, [loadDates]);

  const loadSnapshot = useCallback(async (date) => {
    setSelectedDate(date);
    try {
      const res = await fetch(`${API}/snapshot/${date}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setSnapshot(data);
    } catch (err) {
      toast('Failed to load snapshot', 'error');
    }
  }, [toast]);

  const deleteSnapshot = useCallback(async (date) => {
    if (!window.confirm(`Delete snapshot for ${date}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/snapshot/${date}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setDates(prev => prev.filter(d => d !== date));
      if (selectedDate === date) {
        setSelectedDate(null);
        setSnapshot(null);
      }
      toast(`Snapshot ${date} deleted`);
    } catch (err) {
      toast('Failed to delete snapshot', 'error');
    }
  }, [selectedDate, toast]);

  const handleEditChem = (chem) => {
    setEditChem(chem);
    setShowForm(true);
  };

  const handleFormSave = async (chemData) => {
    if (!snapshot) return;
    const updatedChems = snapshot.chemicals.map(c =>
      c.id === chemData.id ? chemData : c
    );
    try {
      const res = await fetch(`${API}/snapshot/${selectedDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chemicals: updatedChems }),
      });
      if (!res.ok) throw new Error('Failed');
      setSnapshot(prev => ({ ...prev, chemicals: updatedChems }));
      setShowForm(false);
      setEditChem(null);
      toast(`Updated ${chemData.name} in snapshot`);
    } catch (err) {
      toast('Failed to update snapshot', 'error');
    }
  };

  const handleDeleteChemFromSnapshot = async (chemId, chemName) => {
    if (!snapshot) return;
    if (!window.confirm(`Remove "${chemName}" from this snapshot?`)) return;
    const updatedChems = snapshot.chemicals.filter(c => c.id !== chemId);
    try {
      const res = await fetch(`${API}/snapshot/${selectedDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chemicals: updatedChems }),
      });
      if (!res.ok) throw new Error('Failed');
      setSnapshot(prev => ({ ...prev, chemicals: updatedChems }));
      toast(`Removed ${chemName} from snapshot`);
    } catch (err) {
      toast('Failed to update snapshot', 'error');
    }
  };

  const result = useMemo(() => {
    if (!snapshot || !snapshot.chemicals) return null;
    return calculateAll(snapshot.chemicals, snapshot.date);
  }, [snapshot]);

  /** Format ETAs */
  const formatEtas = (c) => {
    const imports = c.imports || [];
    const etas = imports.filter(i => i.eta).map(i => i.eta).sort();
    if (etas.length === 0) return '—';
    return etas.map(e => {
      const d = new Date(e + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }).join(', ');
  };

  if (loading) {
    return <div className="loading">Loading history...</div>;
  }

  return (
    <div className="dashboard-grid">
      <div className="card">
        <div className="card-header">
          <h2>🕐 Saved Snapshots</h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {dates.length} snapshot{dates.length !== 1 ? 's' : ''} saved
          </span>
        </div>
        <div className="card-body">
          {dates.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📸</div>
              <div className="title">No snapshots yet</div>
              <div className="desc">
                Click "Snapshot" in the header to save today's inventory state.
                <br />Snapshots let you track stock levels over time.
              </div>
            </div>
          ) : (
            <div className="snapshot-list">
              {dates.map(date => (
                <div
                  key={date}
                  className={`snapshot-card ${selectedDate === date ? 'active' : ''}`}
                >
                  <div className="snapshot-card-main" onClick={() => loadSnapshot(date)}>
                    <div className="date">
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </div>
                    <div className="label">{date}</div>
                  </div>
                  <button
                    className="snapshot-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteSnapshot(date); }}
                    title="Delete snapshot"
                  >🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Snapshot Details — preserves custom order */}
      {result && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>📊 Snapshot: {selectedDate}</h2>
            </div>
            <div className="card-body">
              <div className="summary-grid" style={{ marginBottom: 0 }}>
                <div className="summary-card total">
                  <div className="number">{result.summary.total}</div>
                  <div className="label">Chemicals</div>
                </div>
                <div className="summary-card critical">
                  <div className="number">{result.summary.critical}</div>
                  <div className="label">Critical</div>
                </div>
                <div className="summary-card warning">
                  <div className="number">{result.summary.warning}</div>
                  <div className="label">Warning</div>
                </div>
                <div className="summary-card ok">
                  <div className="number">{result.summary.ok}</div>
                  <div className="label">OK</div>
                </div>
              </div>
            </div>
          </div>

          <TimelineView chemicals={result.chemicals} referenceDate={selectedDate} />

          <div className="card">
            <div className="card-header">
              <h2>📋 Stock Levels on {selectedDate}</h2>
              <span style={{ fontSize: 12, color: '#64748b' }}>Click ✏️ to edit entries</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Chemical</th>
                      <th className="number">Factory</th>
                      <th className="number">Import</th>
                      <th>ETAs</th>
                      <th className="number">Local</th>
                      <th className="number">Total</th>
                      <th className="number">Use/Day</th>
                      <th className="number">Factory Days</th>
                      <th className="number">Total Days</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.chemicals.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td className="number">{c.factoryStock.toLocaleString()}</td>
                        <td className="number">{(c.totalImport || 0).toLocaleString()}</td>
                        <td style={{ fontSize: 12, color: (c.imports || []).some(i => i.eta) ? 'var(--primary)' : '#94a3b8', maxWidth: 120, whiteSpace: 'normal', lineHeight: 1.4 }}>
                          {formatEtas(c)}
                        </td>
                        <td className="number">{(c.localPurchase || 0).toLocaleString()}</td>
                        <td className="number"><strong>{c.total.toLocaleString()}</strong></td>
                        <td className="number">{c.usePerDay}</td>
                        <td className="number">
                          {c.immediateDays === Infinity ? '—' : c.immediateDays.toFixed(1)}
                        </td>
                        <td className="number">
                          {c.totalDays === Infinity ? '—' : c.totalDays.toFixed(1)}
                        </td>
                        <td>
                          <span className={`badge badge-${c.status}`}>{c.status}</span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button
                              className="btn btn-xs"
                              onClick={() => handleEditChem(snapshot.chemicals.find(sc => sc.id === c.id) || c)}
                              title="Edit"
                            >✏️</button>
                            <button
                              className="btn btn-xs btn-danger"
                              onClick={() => handleDeleteChemFromSnapshot(c.id, c.name)}
                              title="Remove"
                            >🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <ChemicalForm
          chemical={editChem}
          onSave={handleFormSave}
          onCancel={() => { setShowForm(false); setEditChem(null); }}
        />
      )}
    </div>
  );
}
