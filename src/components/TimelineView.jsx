import React, { useState, useMemo } from 'react';

const MAX_DAYS_OPTIONS = [30, 60, 90, 120, 180];

/**
 * Add days to a date string (YYYY-MM-DD) and return a Date object
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + Math.floor(days));
  return d;
}

/**
 * Format a date for display: "Feb 14" or "Mar 1"
 */
function formatShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date with day: "Fri, Feb 14"
 */
function formatWithDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format a date fully: "Fri, Feb 14, 2026"
 */
function formatFull(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TimelineView({ chemicals, referenceDate }) {
  const [maxDays, setMaxDays] = useState(120);

  // Reference date: today or the snapshot date
  const refDate = useMemo(() => {
    if (referenceDate) return referenceDate;
    return new Date().toISOString().split('T')[0];
  }, [referenceDate]);

  // Preserve custom order — only filter out zero-use chemicals
  const sorted = useMemo(
    () => chemicals.filter(c => c.usePerDay > 0),
    [chemicals]
  );

  // Generate calendar-based scale markers
  const scaleMarkers = useMemo(() => {
    const markers = [];
    const startDate = new Date(refDate + 'T00:00:00');

    if (maxDays <= 30) {
      for (let d = 0; d <= maxDays; d += 7) {
        const date = addDays(refDate, d);
        markers.push({ day: d, label: formatShort(date), fullLabel: formatWithDay(date) });
      }
    } else if (maxDays <= 90) {
      for (let d = 0; d <= maxDays; d += 14) {
        const date = addDays(refDate, d);
        markers.push({ day: d, label: formatShort(date), fullLabel: formatWithDay(date) });
      }
    } else {
      markers.push({ day: 0, label: formatShort(startDate), fullLabel: formatWithDay(startDate) });
      let current = new Date(startDate);
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
      while (true) {
        const dayOffset = Math.round((current - startDate) / (1000 * 60 * 60 * 24));
        if (dayOffset > maxDays) break;
        markers.push({
          day: dayOffset,
          label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullLabel: current.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          isMonthStart: true,
        });
        current = new Date(current);
        current.setMonth(current.getMonth() + 1);
      }
    }

    return markers;
  }, [refDate, maxDays]);

  // Today marker position (for history view, show where "today" falls)
  const todayMarker = useMemo(() => {
    if (!referenceDate) return null;
    const today = new Date();
    const ref = new Date(refDate + 'T00:00:00');
    const dayOffset = Math.round((today - ref) / (1000 * 60 * 60 * 24));
    if (dayOffset < 0 || dayOffset > maxDays) return null;
    return { day: dayOffset, label: 'Today' };
  }, [referenceDate, refDate, maxDays]);

  if (sorted.length === 0) {
    return (
      <div className="card">
        <div className="card-body empty-state">
          <div className="icon">📊</div>
          <div className="title">No timeline data</div>
          <div className="desc">Add chemicals with consumption rates to see the timeline.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>📅 Supply Timeline</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="timeline-ref-label">
            From: <strong>{formatWithDay(new Date(refDate + 'T00:00:00'))}</strong>
          </span>
          <select
            value={maxDays}
            onChange={e => setMaxDays(Number(e.target.value))}
            className="timeline-range-select"
          >
            {MAX_DAYS_OPTIONS.map(d => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </div>
      </div>
      <div className="card-body">
        {/* Legend */}
        <div className="timeline-legend">
          <div className="legend-item">
            <div className="legend-color factory" />
            Factory + Local
          </div>
          <div className="legend-item">
            <div className="legend-color import" />
            Import
          </div>
          <div className="legend-item">
            <div className="legend-color gap" />
            Supply Gap
          </div>
          <div className="legend-item">
            <div className="legend-color eta-marker" />
            ETA Marker
          </div>
        </div>

        {/* Calendar grid header */}
        <div className="timeline-calendar">
          <div className="timeline-scale-header">
            <div className="timeline-name-spacer" />
            <div className="timeline-scale-bar">
              {scaleMarkers.map((m, i) => (
                <div
                  key={i}
                  className={`scale-marker ${m.isMonthStart ? 'month-start' : ''}`}
                  style={{ left: `${(m.day / maxDays) * 100}%` }}
                  title={m.fullLabel}
                >
                  <div className="scale-tick" />
                  <span className="scale-label">{m.label}</span>
                </div>
              ))}
              {todayMarker && (
                <div
                  className="scale-marker today-marker"
                  style={{ left: `${(todayMarker.day / maxDays) * 100}%` }}
                >
                  <div className="scale-tick today-tick" />
                  <span className="scale-label today-label">Today</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline rows */}
          <div className="timeline-container">
            {sorted.map(chem => (
              <TimelineRow
                key={chem.id}
                chem={chem}
                maxDays={maxDays}
                refDate={refDate}
                scaleMarkers={scaleMarkers}
                todayMarker={todayMarker}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ chem, maxDays, refDate, scaleMarkers, todayMarker }) {
  const segments = chem.timeline || [];
  const imports = chem.imports || [];

  return (
    <div className="timeline-row">
      <div className="timeline-name">
        <span>{chem.name}</span>
        <span className="days-info">
          {chem.immediateDays === Infinity
            ? 'N/A'
            : `${chem.immediateDays.toFixed(1)}d factory`}{' '}
          • {chem.totalDays === Infinity ? '∞' : `${chem.totalDays.toFixed(1)}d total`}
        </span>
      </div>

      <div className="timeline-bar-container">
        {/* Month/period gridlines */}
        {scaleMarkers
          .filter(m => m.isMonthStart)
          .map((m, i) => (
            <div
              key={`grid-${i}`}
              className="timeline-gridline"
              style={{ left: `${(m.day / maxDays) * 100}%` }}
            />
          ))}

        {/* Today vertical line */}
        {todayMarker && (
          <div
            className="timeline-today-line"
            style={{ left: `${(todayMarker.day / maxDays) * 100}%` }}
          />
        )}

        {/* Segments */}
        {segments.map((seg, i) => {
          const widthPct = Math.min((seg.days / maxDays) * 100, 100);
          const leftPct = (seg.startDay / maxDays) * 100;

          if (leftPct >= 100) return null;

          const startDate = addDays(refDate, seg.startDay);
          const endDate = addDays(refDate, seg.endDay);
          const dateRangeLabel = `${formatWithDay(startDate)} → ${formatWithDay(endDate)}`;

          return (
            <div
              key={i}
              className={`timeline-segment ${seg.type}`}
              style={{
                width: `${Math.max(widthPct, 0.5)}%`,
                position: 'absolute',
                left: `${leftPct}%`,
              }}
              title={`${seg.label}\n${dateRangeLabel}`}
            >
              {widthPct > 12 ? (
                <span className="seg-label-full">
                  {formatShort(startDate)} – {formatShort(endDate)}
                </span>
              ) : widthPct > 6 ? (
                <span>{seg.days.toFixed(0)}d</span>
              ) : null}
              <div className="tooltip">
                <div className="tooltip-title">{seg.label}</div>
                <div className="tooltip-dates">{dateRangeLabel}</div>
                <div className="tooltip-days">{seg.days.toFixed(1)} days</div>
              </div>
            </div>
          );
        })}

        {/* ETA markers — one for each import with an ETA */}
        {imports.map((imp, idx) => {
          if (!imp.eta || (imp.qty || 0) <= 0) return null;
          const refDateObj = new Date(refDate + 'T00:00:00');
          const eta = new Date(imp.eta + 'T00:00:00');
          const etaDays = Math.round((eta - refDateObj) / (1000 * 60 * 60 * 24));
          if (etaDays < 0 || etaDays > maxDays) return null;
          const leftPct = (etaDays / maxDays) * 100;
          const label = imp.label || `Import ${idx + 1}`;
          return (
            <div
              key={`eta-${idx}`}
              className="eta-marker-line"
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: 0,
                bottom: 0,
                width: 2,
                background: '#1d4ed8',
                zIndex: 5,
              }}
              title={`${label} ETA: ${formatFull(eta)}\nQty: ${imp.qty.toLocaleString()} ${chem.unit || 'bags'}`}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -6,
                  left: -4,
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '6px solid #1d4ed8',
                }}
              />
              <div className="eta-date-label">
                {formatShort(eta)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
