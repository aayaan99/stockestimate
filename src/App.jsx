import React, { useState, useEffect, useCallback, useRef } from 'react';
import Dashboard from './components/Dashboard';
import InventoryTable from './components/InventoryTable';
import HistoryView from './components/HistoryView';
import { exportToPdf, exportToImage } from './utils/exportUtils';

const API = '/api';

export default function App() {
  const [chemicals, setChemicals] = useState([]);
  const [config, setConfig] = useState({ shifts: { EVA: 2, EVR: 2 } });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split('T')[0]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Toast notifications
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Load data from server
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/data`);
      const data = await res.json();
      setChemicals(data.chemicals || []);
      setConfig(data.config || { shifts: { EVA: 2, EVR: 2 } });
    } catch (err) {
      console.error('Failed to load data:', err);
      toast('Failed to load data from server', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Save data to server (silent=true skips the toast for inline edits)
  const saveData = useCallback(async (newChemicals, newConfig, { silent = false } = {}) => {
    const chems = newChemicals || chemicals;
    const conf = newConfig || config;
    try {
      const res = await fetch(`${API}/data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chemicals: chems, config: conf }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setChemicals(chems);
      if (newConfig) setConfig(conf);
      if (!silent) toast('Data saved');
    } catch (err) {
      console.error('Failed to save data:', err);
      toast('Failed to save data', 'error');
    }
  }, [chemicals, config, toast]);

  // Take a snapshot for a selected date
  const takeSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`${API}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: snapshotDate }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast(`Snapshot saved for ${data.date}`);
    } catch (err) {
      console.error('Snapshot error:', err);
      toast(`Failed to save snapshot: ${err.message}`, 'error');
    }
  }, [toast, snapshotDate]);

  // Export handlers
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportToPdf('export-area', 'StockEstimate');
      toast('PDF exported');
    } catch (err) {
      toast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportImage = async () => {
    setExporting(true);
    try {
      await exportToImage('export-area', 'StockEstimate');
      toast('Image exported');
    } catch (err) {
      toast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading StockEstimate...</div>;
  }

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <span>📦</span> StockEstimate
        </div>
        <div className="header-right">
          <span className="header-date">{today}</span>
          <div className="header-actions">
            <button className="btn btn-sm btn-export" onClick={handleExportPdf} disabled={exporting}>
              📄 PDF
            </button>
            <button className="btn btn-sm btn-export" onClick={handleExportImage} disabled={exporting}>
              🖼️ JPEG
            </button>
            <div className="snapshot-date-group">
              <input
                type="date"
                className="snapshot-date-input"
                value={snapshotDate}
                onChange={e => setSnapshotDate(e.target.value)}
                title="Select date for snapshot"
              />
              <button className="btn btn-success btn-sm" onClick={takeSnapshot}>
                📸 Snapshot
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tabs">
        {[
          { id: 'dashboard', label: '📊 Dashboard' },
          { id: 'inventory', label: '📋 Inventory' },
          { id: 'history', label: '🕐 History' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="main-content" id="export-area">
        {activeTab === 'dashboard' && (
          <Dashboard chemicals={chemicals} config={config} />
        )}
        {activeTab === 'inventory' && (
          <InventoryTable
            chemicals={chemicals}
            config={config}
            onSave={saveData}
            onConfigChange={(newConfig) => saveData(null, newConfig)}
            toast={toast}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView toast={toast} />
        )}
      </main>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? '✅' : '❌'} {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
