import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { calculateAll } from '../utils/calculations';
import ChemicalForm from './ChemicalForm';

/** Inline editable number input — saves on blur, not on every keystroke */
function InlineNumberInput({ value, onChange, style, min = 0 }) {
  const [local, setLocal] = useState(value);
  const ref = useRef(null);

  // Sync from parent when value changes externally (e.g., after save recalculates)
  useEffect(() => { setLocal(value); }, [value]);

  const handleBlur = () => {
    const num = Number(local);
    if (!isNaN(num) && num !== value) {
      onChange(num);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur(); // triggers handleBlur
    }
  };

  return (
    <input
      ref={ref}
      className="inline-input"
      type="number"
      min={min}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={style}
    />
  );
}

export default function InventoryTable({ chemicals, config, onSave, onConfigChange, toast }) {
  const [showForm, setShowForm] = useState(false);
  const [editChem, setEditChem] = useState(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('custom'); // 'custom' | 'urgency'

  // Drag state
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const dragRef = useRef(null);

  const result = useMemo(() => calculateAll(chemicals), [chemicals]);

  const filtered = useMemo(() => {
    if (!search.trim()) return result.chemicals;
    const q = search.toLowerCase();
    return result.chemicals.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
    );
  }, [result.chemicals, search]);

  // Sort based on mode
  const sorted = useMemo(() => {
    if (sortMode === 'urgency') {
      return [...filtered].sort((a, b) => a.immediateDays - b.immediateDays);
    }
    return filtered;
  }, [filtered, sortMode]);

  const getOriginalIndex = useCallback((chemId) => {
    return chemicals.findIndex(c => c.id === chemId);
  }, [chemicals]);

  const handleAdd = () => {
    setEditChem(null);
    setShowForm(true);
  };

  const handleEdit = (chem) => {
    const raw = chemicals.find(c => c.id === chem.id);
    setEditChem(raw || chem);
    setShowForm(true);
  };

  const handleDelete = (chem) => {
    if (window.confirm(`Delete "${chem.name}"? This cannot be undone.`)) {
      const updated = chemicals.filter(c => c.id !== chem.id);
      onSave(updated);
      toast(`Deleted ${chem.name}`);
    }
  };

  const handleFormSave = (chemData) => {
    let updated;
    if (editChem) {
      updated = chemicals.map(c => (c.id === chemData.id ? chemData : c));
    } else {
      updated = [...chemicals, chemData];
    }
    onSave(updated);
    setShowForm(false);
    setEditChem(null);
    toast(editChem ? `Updated ${chemData.name}` : `Added ${chemData.name}`);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditChem(null);
  };

  // Quick inline stock update — silent (no toast) since user is doing rapid edits
  const handleQuickUpdate = useCallback((chemId, field, value) => {
    const num = Number(value);
    if (isNaN(num)) return;
    const updated = chemicals.map(c => {
      if (c.id === chemId) {
        return { ...c, [field]: num, lastUpdated: new Date().toISOString().split('T')[0] };
      }
      return c;
    });
    onSave(updated, null, { silent: true });
  }, [chemicals, onSave]);

  // === Reorder functions ===
  const moveItem = useCallback((fromId, toId) => {
    if (fromId === toId) return;
    const fromIdx = chemicals.findIndex(c => c.id === fromId);
    const toIdx = chemicals.findIndex(c => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const updated = [...chemicals];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    onSave(updated);
  }, [chemicals, onSave]);

  const moveUp = useCallback((chemId) => {
    const idx = chemicals.findIndex(c => c.id === chemId);
    if (idx <= 0) return;
    const updated = [...chemicals];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    onSave(updated);
  }, [chemicals, onSave]);

  const moveDown = useCallback((chemId) => {
    const idx = chemicals.findIndex(c => c.id === chemId);
    if (idx === -1 || idx >= chemicals.length - 1) return;
    const updated = [...chemicals];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    onSave(updated);
  }, [chemicals, onSave]);

  // === Drag handlers ===
  const handleDragStart = (e, chemId) => {
    setDragIndex(chemId);
    dragRef.current = chemId;
    e.dataTransfer.effectAllowed = 'move';
    if (e.target) e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    setDragIndex(null);
    setOverIndex(null);
    dragRef.current = null;
  };

  const handleDragOver = (e, chemId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (chemId !== overIndex) setOverIndex(chemId);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = dragRef.current;
    if (sourceId && sourceId !== targetId) moveItem(sourceId, targetId);
    setDragIndex(null);
    setOverIndex(null);
    dragRef.current = null;
  };

  const isCustomOrder = sortMode === 'custom' && !search.trim();

  /** Format imports summary for a calculated chemical */
  const importsInfo = (c) => {
    const imports = c.imports || [];
    if (imports.length === 0) return { summary: '—', etas: '—', etaColor: '#94a3b8' };
    const totalQty = c.totalImport || 0;
    const etas = imports.filter(i => i.eta).map(i => i.eta).sort();
    const summary = `${totalQty.toLocaleString()} (${imports.length})`;
    const etaStr = etas.length > 0
      ? etas.map(e => {
          const d = new Date(e + 'T00:00:00');
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }).join(', ')
      : '—';
    return { summary, etas: etaStr, etaColor: etas.length > 0 ? 'var(--primary)' : '#94a3b8' };
  };

  return (
    <div>
      {/* Shift Config */}
      <div className="shift-config">
        <span style={{ fontWeight: 600, fontSize: 14 }}>⚙️ Shifts:</span>
        {Object.entries(config.shifts || {}).map(([line, shifts]) => (
          <label key={line}>
            {line}:
            <input
              type="number"
              min="0"
              max="4"
              value={shifts}
              onChange={e => {
                const newConfig = {
                  ...config,
                  shifts: { ...config.shifts, [line]: Number(e.target.value) },
                };
                onConfigChange(newConfig);
              }}
            />
          </label>
        ))}
        <button
          className="btn btn-xs"
          onClick={() => {
            const name = prompt('Add shift line name (e.g., EVR2):');
            if (name && name.trim()) {
              const newConfig = {
                ...config,
                shifts: { ...config.shifts, [name.trim()]: 2 },
              };
              onConfigChange(newConfig);
            }
          }}
        >
          + Add Line
        </button>
      </div>

      <div className="card">
        <div className="card-header card-header-responsive">
          <h2>📋 Chemical Inventory ({chemicals.length})</h2>
          <div className="card-header-actions">
            <div className="sort-toggle">
              <button
                className={`sort-btn ${sortMode === 'custom' ? 'active' : ''}`}
                onClick={() => setSortMode('custom')}
                title="Custom order — drag to rearrange"
              >
                ↕️ Custom
              </button>
              <button
                className={`sort-btn ${sortMode === 'urgency' ? 'active' : ''}`}
                onClick={() => setSortMode('urgency')}
                title="Sort by urgency (critical first)"
              >
                🔥 Urgency
              </button>
            </div>
            <input
              type="text"
              placeholder="🔍 Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>
              ➕ Add
            </button>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {/* Mobile card view */}
          <div className="mobile-cards">
            {sorted.map(c => {
              const info = importsInfo(c);
              return (
                <div key={c.id} className="mobile-card">
                  <div className="mobile-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isCustomOrder && (
                        <div className="reorder-btns-mobile">
                          <button className="reorder-btn" onClick={() => moveUp(c.id)} disabled={getOriginalIndex(c.id) === 0}>▲</button>
                          <button className="reorder-btn" onClick={() => moveDown(c.id)} disabled={getOriginalIndex(c.id) === chemicals.length - 1}>▼</button>
                        </div>
                      )}
                      <strong>{c.name}</strong>
                    </div>
                    <span className={`badge badge-${c.status}`}>{c.status}</span>
                  </div>
                  <div className="mobile-card-grid">
                    <div><span className="mobile-label">Factory</span><span>{c.factoryStock.toLocaleString()}</span></div>
                    <div><span className="mobile-label">Import ({(c.imports || []).length})</span><span>{(c.totalImport || 0).toLocaleString()}</span></div>
                    <div><span className="mobile-label">Local</span><span>{(c.localPurchase || 0).toLocaleString()}</span></div>
                    <div><span className="mobile-label">Use/Day</span><span>{c.usePerDay}</span></div>
                    <div><span className="mobile-label">Factory Days</span><span style={{ fontWeight: 700, color: c.immediateDays <= 3 ? 'var(--red)' : c.immediateDays <= 10 ? 'var(--amber)' : 'inherit' }}>{c.immediateDays === Infinity ? '—' : c.immediateDays.toFixed(1)}</span></div>
                    <div><span className="mobile-label">Total Days</span><span>{c.totalDays === Infinity ? '—' : c.totalDays.toFixed(1)}</span></div>
                    <div className="mobile-card-full"><span className="mobile-label">ETAs</span><span style={{ color: info.etaColor, fontSize: 12 }}>{info.etas}</span></div>
                  </div>
                  <div className="mobile-card-actions">
                    <button className="btn btn-xs" onClick={() => handleEdit(c)}>✏️ Edit</button>
                    <button className="btn btn-xs btn-danger" onClick={() => handleDelete(c)}>🗑️</button>
                  </div>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                {search ? 'No chemicals match your search' : 'No chemicals added yet'}
              </div>
            )}
          </div>

          {/* Desktop table view */}
          <div className="table-wrapper desktop-table">
            <table>
              <thead>
                <tr>
                  {isCustomOrder && <th style={{ width: 50 }}>#</th>}
                  <th>Chemical</th>
                  <th>Category</th>
                  <th className="number">Factory Stock</th>
                  <th className="number">Import (qty)</th>
                  <th>ETAs</th>
                  <th className="number">Local Purch.</th>
                  <th className="number">Total</th>
                  <th className="number">Use/Day</th>
                  <th className="number">Factory Days</th>
                  <th className="number">Total Days</th>
                  <th className="number">Months</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(c => {
                  const info = importsInfo(c);
                  return (
                    <tr
                      key={c.id}
                      className={`
                        ${isCustomOrder ? 'draggable-row' : ''}
                        ${dragIndex === c.id ? 'dragging' : ''}
                        ${overIndex === c.id && dragIndex !== c.id ? 'drag-over' : ''}
                      `}
                      draggable={isCustomOrder}
                      onDragStart={isCustomOrder ? (e) => handleDragStart(e, c.id) : undefined}
                      onDragEnd={isCustomOrder ? handleDragEnd : undefined}
                      onDragOver={isCustomOrder ? (e) => handleDragOver(e, c.id) : undefined}
                      onDrop={isCustomOrder ? (e) => handleDrop(e, c.id) : undefined}
                    >
                      {isCustomOrder && (
                        <td className="reorder-cell">
                          <div className="reorder-handle" title="Drag to reorder">
                            <span className="drag-icon">⠿</span>
                          </div>
                          <div className="reorder-arrows">
                            <button className="reorder-btn" onClick={() => moveUp(c.id)} disabled={getOriginalIndex(c.id) === 0}>▲</button>
                            <button className="reorder-btn" onClick={() => moveDown(c.id)} disabled={getOriginalIndex(c.id) === chemicals.length - 1}>▼</button>
                          </div>
                        </td>
                      )}
                      <td>
                        <strong>{c.name}</strong>
                        {c.notes && (
                          <span title={c.notes} style={{ marginLeft: 4, cursor: 'help', fontSize: 12 }}>📝</span>
                        )}
                      </td>
                      <td style={{ color: '#64748b', fontSize: 12 }}>{c.category}</td>
                      <td className="number">
                        <InlineNumberInput
                          value={c.factoryStock}
                          onChange={val => handleQuickUpdate(c.id, 'factoryStock', val)}
                        />
                      </td>
                      <td className="number">
                        <span
                          style={{ cursor: 'pointer', borderBottom: '1px dashed var(--primary)', color: (c.imports || []).length > 0 ? 'var(--text)' : '#94a3b8' }}
                          onClick={() => handleEdit(c)}
                          title="Click to edit imports"
                        >
                          {info.summary}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: info.etaColor, maxWidth: 140, whiteSpace: 'normal', lineHeight: 1.4 }}>
                        {info.etas}
                      </td>
                      <td className="number">
                        <InlineNumberInput
                          value={c.localPurchase || 0}
                          onChange={val => handleQuickUpdate(c.id, 'localPurchase', val)}
                        />
                      </td>
                      <td className="number">
                        <strong>{c.total.toLocaleString()}</strong>
                      </td>
                      <td className="number">
                        <InlineNumberInput
                          value={c.usePerDay}
                          onChange={val => handleQuickUpdate(c.id, 'usePerDay', val)}
                          style={{ width: 65 }}
                        />
                      </td>
                      <td className="number">
                        <strong
                          style={{
                            color:
                              c.immediateDays <= 3 ? 'var(--red)'
                              : c.immediateDays <= 10 ? 'var(--amber)'
                              : 'inherit',
                          }}
                        >
                          {c.immediateDays === Infinity ? '—' : c.immediateDays.toFixed(1)}
                        </strong>
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
                      <td>
                        <div className="action-btns">
                          <button className="btn btn-xs" onClick={() => handleEdit(c)} title="Edit">✏️</button>
                          <button className="btn btn-xs btn-danger" onClick={() => handleDelete(c)} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={isCustomOrder ? 14 : 13} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      {search ? 'No chemicals match your search' : 'No chemicals added yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <ChemicalForm
          chemical={editChem}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}
