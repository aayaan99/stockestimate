import React, { useState, useEffect } from 'react';
import { emptyChemical, emptyImport, migrateChemical, todayStr } from '../utils/calculations';

export default function ChemicalForm({ chemical, onSave, onCancel }) {
  const isNew = !chemical;
  const [form, setForm] = useState(() => {
    const base = chemical ? migrateChemical(chemical) : emptyChemical();
    return { ...base, imports: base.imports || [] };
  });

  useEffect(() => {
    const base = chemical ? migrateChemical(chemical) : emptyChemical();
    setForm({ ...base, imports: base.imports || [] });
  }, [chemical]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field, value) => {
    const num = value === '' ? 0 : Number(value);
    if (!isNaN(num)) handleChange(field, num);
  };

  // === Import entry management ===
  const addImportEntry = () => {
    setForm(prev => ({
      ...prev,
      imports: [...prev.imports, emptyImport()],
    }));
  };

  const updateImportEntry = (index, field, value) => {
    setForm(prev => {
      const imports = [...prev.imports];
      imports[index] = { ...imports[index], [field]: value };
      return { ...prev, imports };
    });
  };

  const updateImportQty = (index, value) => {
    const num = value === '' ? 0 : Number(value);
    if (!isNaN(num)) updateImportEntry(index, 'qty', num);
  };

  const removeImportEntry = (index) => {
    setForm(prev => ({
      ...prev,
      imports: prev.imports.filter((_, i) => i !== index),
    }));
  };

  const totalImport = form.imports.reduce((sum, i) => sum + (i.qty || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Chemical name is required');
      return;
    }
    // Clean up empty import entries (qty = 0)
    const cleanedImports = form.imports.filter(i => (i.qty || 0) > 0);
    onSave({
      ...form,
      imports: cleanedImports,
      name: form.name.trim(),
      lastUpdated: todayStr(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isNew ? '➕ Add Chemical' : `✏️ Edit ${form.name}`}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              {/* Basic Info */}
              <div className="form-section-title">Basic Information</div>

              <div className="form-group">
                <label>Chemical Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  placeholder="e.g., EVA 18VA"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={e => handleChange('category', e.target.value)}
                >
                  <option value="Chemical">Chemical</option>
                  <option value="Additive">Additive</option>
                  <option value="Filler">Filler</option>
                  <option value="Polymer">Polymer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Unit</label>
                <select
                  value={form.unit}
                  onChange={e => handleChange('unit', e.target.value)}
                >
                  <option value="bags">bags</option>
                  <option value="kg">kg</option>
                  <option value="ltr">ltr</option>
                  <option value="pcs">pcs</option>
                  <option value="drums">drums</option>
                </select>
              </div>

              <div className="form-group">
                <label>Use Per Day</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.usePerDay || ''}
                  onChange={e => handleNumberChange('usePerDay', e.target.value)}
                  placeholder="0"
                />
              </div>

              {/* Stock Levels */}
              <div className="form-section-title">Stock Levels</div>

              <div className="form-group">
                <label>Factory + Adda Stock</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.factoryStock || ''}
                  onChange={e => handleNumberChange('factoryStock', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Local Purchase</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.localPurchase || ''}
                  onChange={e => handleNumberChange('localPurchase', e.target.value)}
                  placeholder="0"
                />
              </div>

              {/* Import Shipments */}
              <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📦 Import Shipments {totalImport > 0 && <span style={{ fontWeight: 400, fontSize: 12, color: '#64748b' }}>({totalImport.toLocaleString()} {form.unit} total)</span>}</span>
                <button
                  type="button"
                  className="btn btn-xs btn-primary"
                  onClick={addImportEntry}
                  style={{ marginTop: -2 }}
                >
                  + Add Shipment
                </button>
              </div>

              {form.imports.length === 0 ? (
                <div className="form-group full-width" style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: 13 }}>
                  No import shipments. Click "+ Add Shipment" to add one.
                </div>
              ) : (
                form.imports.map((imp, idx) => (
                  <div key={idx} className="import-entry full-width">
                    <div className="import-entry-header">
                      <span className="import-entry-num">Shipment #{idx + 1}</span>
                      <button
                        type="button"
                        className="import-entry-remove"
                        onClick={() => removeImportEntry(idx)}
                        title="Remove this shipment"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="import-entry-fields">
                      <div className="form-group">
                        <label>Quantity ({form.unit})</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={imp.qty || ''}
                          onChange={e => updateImportQty(idx, e.target.value)}
                          placeholder="Enter quantity"
                        />
                      </div>
                      <div className="form-group">
                        <label>📅 ETA (Arrival Date)</label>
                        <input
                          type="date"
                          value={imp.eta || ''}
                          onChange={e => updateImportEntry(idx, 'eta', e.target.value || null)}
                          className="eta-input"
                        />
                      </div>
                      <div className="form-group import-label-field">
                        <label>Label (optional)</label>
                        <input
                          type="text"
                          value={imp.label || ''}
                          onChange={e => updateImportEntry(idx, 'label', e.target.value)}
                          placeholder="e.g., Shipment from China, Container #XYZ"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Notes */}
              <div className="form-section-title">Additional</div>

              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={form.notes || ''}
                  onChange={e => handleChange('notes', e.target.value)}
                  placeholder="Any additional notes (e.g., bag sizes, supplier info, etc.)"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isNew ? '➕ Add Chemical' : '💾 Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
