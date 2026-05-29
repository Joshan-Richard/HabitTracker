import React, { useState, useMemo, useCallback } from 'react';
import './ReportModal.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function formatDate(dateStr) {
    // dateStr = 'YYYY-MM-DD'
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function padTwo(n) {
    return String(n).padStart(2, '0');
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ─── CSV Export ──────────────────────────────────────────────────────────────

function generateMonthlyCsv(tasks, completions, year, month) {
    const days = getDaysInMonth(year, month);
    const monthStr = `${year}-${padTwo(month + 1)}`;

    // Header row
    const headers = ['Task', 'Type', ...Array.from({ length: days }, (_, i) => `${padTwo(i + 1)}`), 'Total ✓', 'Rate %'];
    const rows = [headers.join(',')];

    for (const task of tasks) {
        let total = 0;
        const cells = Array.from({ length: days }, (_, i) => {
            const dateStr = `${monthStr}-${padTwo(i + 1)}`;
            const key = `${task.id}_${dateStr}`;
            const done = completions[key] || false;
            if (done) total++;
            return done ? '1' : '0';
        });
        const rate = ((total / days) * 100).toFixed(0);
        rows.push([`"${task.name}"`, task.type, ...cells, total, `${rate}%`].join(','));
    }

    return rows.join('\n');
}

function generateYearlyCsv(tasks, completions, year) {
    const headers = ['Task', 'Type', ...MONTH_NAMES, 'Total ✓', 'Avg Rate %'];
    const rows = [headers.join(',')];

    for (const task of tasks) {
        let grandTotal = 0;
        let totalDays = 0;
        const monthCells = MONTH_NAMES.map((_, mIdx) => {
            const days = getDaysInMonth(year, mIdx);
            let count = 0;
            for (let d = 1; d <= days; d++) {
                const dateStr = `${year}-${padTwo(mIdx + 1)}-${padTwo(d)}`;
                const key = `${task.id}_${dateStr}`;
                if (completions[key]) count++;
            }
            grandTotal += count;
            totalDays += days;
            return `${count}/${days}`;
        });
        const avgRate = totalDays > 0 ? ((grandTotal / totalDays) * 100).toFixed(0) : '0';
        rows.push([`"${task.name}"`, task.type, ...monthCells, grandTotal, `${avgRate}%`].join(','));
    }
    return rows.join('\n');
}

function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── PDF Print Export ────────────────────────────────────────────────────────

function generateMonthlyHtml(tasks, completions, year, month) {
    const days = getDaysInMonth(year, month);
    const monthStr = `${year}-${padTwo(month + 1)}`;
    const title = `HabitFlow — ${MONTH_NAMES[month]} ${year}`;

    const headerCells = Array.from({ length: days }, (_, i) =>
        `<th>${padTwo(i + 1)}</th>`
    ).join('');

    const taskRows = tasks.map(task => {
        let total = 0;
        const cells = Array.from({ length: days }, (_, i) => {
            const dateStr = `${monthStr}-${padTwo(i + 1)}`;
            const done = completions[`${task.id}_${dateStr}`] || false;
            if (done) total++;
            return `<td class="${done ? 'done' : ''}">${done ? '✓' : ''}</td>`;
        }).join('');
        const rate = ((total / days) * 100).toFixed(0);
        return `<tr>
            <td class="task-name-cell">${task.name}</td>
            <td class="type-cell">${task.type === 'permanent' ? '∞' : '1'}</td>
            ${cells}
            <td class="total-cell">${total}</td>
            <td class="rate-cell">${rate}%</td>
        </tr>`;
    }).join('');

    return buildPrintHtml(title, `
        <thead>
            <tr>
                <th class="task-col">Task</th>
                <th class="type-col">Type</th>
                ${headerCells}
                <th>✓</th>
                <th>Rate</th>
            </tr>
        </thead>
        <tbody>${taskRows}</tbody>
    `);
}

function generateYearlyHtml(tasks, completions, year) {
    const title = `HabitFlow — Annual Report ${year}`;

    const headerCells = MONTH_NAMES.map(m => `<th>${m.slice(0, 3)}</th>`).join('');

    const taskRows = tasks.map(task => {
        let grandTotal = 0;
        let totalDays = 0;
        const cells = MONTH_NAMES.map((_, mIdx) => {
            const days = getDaysInMonth(year, mIdx);
            let count = 0;
            for (let d = 1; d <= days; d++) {
                const dateStr = `${year}-${padTwo(mIdx + 1)}-${padTwo(d)}`;
                if (completions[`${task.id}_${dateStr}`]) count++;
            }
            grandTotal += count;
            totalDays += days;
            const pct = Math.round((count / days) * 100);
            return `<td class="${pct >= 80 ? 'done' : pct >= 50 ? 'partial' : ''}">${pct}%</td>`;
        }).join('');
        const avgPct = totalDays > 0 ? Math.round((grandTotal / totalDays) * 100) : 0;
        return `<tr>
            <td class="task-name-cell">${task.name}</td>
            <td class="type-cell">${task.type === 'permanent' ? '∞' : '1'}</td>
            ${cells}
            <td class="total-cell">${grandTotal}</td>
            <td class="rate-cell">${avgPct}%</td>
        </tr>`;
    }).join('');

    return buildPrintHtml(title, `
        <thead>
            <tr>
                <th class="task-col">Task</th>
                <th class="type-col">Type</th>
                ${headerCells}
                <th>Total</th>
                <th>Avg</th>
            </tr>
        </thead>
        <tbody>${taskRows}</tbody>
    `);
}

function buildPrintHtml(title, tableBody) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a2e; font-size: 11px; padding: 20px; }
  h1 { font-size: 18px; margin-bottom: 4px; color: #1e4d8c; }
  .subtitle { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #dde; padding: 4px 5px; text-align: center; }
  th { background: #1e4d8c; color: white; font-weight: 600; font-size: 10px; }
  .task-col { text-align: left; min-width: 120px; }
  .type-col { width: 36px; }
  .task-name-cell { text-align: left; font-weight: 500; }
  .type-cell { color: #666; }
  .done { background: #d1fae5; color: #065f46; font-weight: 700; }
  .partial { background: #fef3c7; color: #92400e; }
  .total-cell { font-weight: 700; color: #1e4d8c; }
  .rate-cell { font-weight: 600; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:nth-child(even) td.done { background: #bbf7d0; }
  .footer { margin-top: 16px; font-size: 10px; color: #999; }
  @media print { body { padding: 8px; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })} · HabitFlow</div>
  <table>${tableBody}</table>
  <div class="footer">✓ = completed &nbsp;|&nbsp; % = completion rate for the period</div>
</body>
</html>`;
}

function printHtml(html) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;height:800px;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    // Wait for fonts/images to load
    iframe.contentWindow.onload = () => {
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    };
    // Fallback trigger
    setTimeout(() => {
        try { iframe.contentWindow.print(); } catch (_) {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 1500);
    }, 600);
}

// ─── Component ───────────────────────────────────────────────────────────────

const ReportModal = ({ tasks = [], completions = {}, onClose }) => {
    const now = new Date();
    const [reportType, setReportType] = useState('monthly'); // 'monthly' | 'yearly'
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [exporting, setExporting] = useState(null); // 'csv' | 'pdf' | null

    // Available years (current year ± 2)
    const years = useMemo(() => {
        const cy = now.getFullYear();
        return [cy - 2, cy - 1, cy, cy + 1];
    }, [now]);

    // Summary stats for the selected period
    const stats = useMemo(() => {
        if (!tasks.length) return { total: 0, completed: 0, rate: 0, bestTask: null };

        let totalSlots = 0;
        let totalCompleted = 0;
        let taskStats = [];

        if (reportType === 'monthly') {
            const days = getDaysInMonth(selectedYear, selectedMonth);
            const monthStr = `${selectedYear}-${padTwo(selectedMonth + 1)}`;

            for (const task of tasks) {
                let count = 0;
                for (let d = 1; d <= days; d++) {
                    const key = `${task.id}_${monthStr}-${padTwo(d)}`;
                    if (completions[key]) count++;
                }
                taskStats.push({ name: task.name, count, possible: days });
                totalCompleted += count;
                totalSlots += days;
            }
        } else {
            for (const task of tasks) {
                let count = 0;
                let possible = 0;
                for (let m = 0; m < 12; m++) {
                    const days = getDaysInMonth(selectedYear, m);
                    for (let d = 1; d <= days; d++) {
                        const key = `${task.id}_${selectedYear}-${padTwo(m + 1)}-${padTwo(d)}`;
                        if (completions[key]) count++;
                    }
                    possible += days;
                }
                taskStats.push({ name: task.name, count, possible });
                totalCompleted += count;
                totalSlots += possible;
            }
        }

        taskStats.sort((a, b) => b.count - a.count);
        return {
            total: totalSlots,
            completed: totalCompleted,
            rate: totalSlots > 0 ? Math.round((totalCompleted / totalSlots) * 100) : 0,
            bestTask: taskStats[0] || null,
            worstTask: taskStats[taskStats.length - 1] || null,
            taskStats
        };
    }, [tasks, completions, reportType, selectedMonth, selectedYear]);

    const handleExportCsv = useCallback(async () => {
        setExporting('csv');
        try {
            let csv, filename;
            if (reportType === 'monthly') {
                csv = generateMonthlyCsv(tasks, completions, selectedYear, selectedMonth);
                filename = `HabitFlow_${MONTH_NAMES[selectedMonth]}_${selectedYear}.csv`;
            } else {
                csv = generateYearlyCsv(tasks, completions, selectedYear);
                filename = `HabitFlow_Annual_${selectedYear}.csv`;
            }
            downloadCsv(csv, filename);
        } finally {
            setTimeout(() => setExporting(null), 800);
        }
    }, [reportType, tasks, completions, selectedYear, selectedMonth]);

    const handleExportPdf = useCallback(async () => {
        setExporting('pdf');
        try {
            let html;
            if (reportType === 'monthly') {
                html = generateMonthlyHtml(tasks, completions, selectedYear, selectedMonth);
            } else {
                html = generateYearlyHtml(tasks, completions, selectedYear);
            }
            printHtml(html);
        } finally {
            setTimeout(() => setExporting(null), 1000);
        }
    }, [reportType, tasks, completions, selectedYear, selectedMonth]);

    const periodLabel = reportType === 'monthly'
        ? `${MONTH_NAMES[selectedMonth]} ${selectedYear}`
        : `Year ${selectedYear}`;

    return (
        <div className="modal-overlay report-overlay" onClick={onClose}>
            <div className="modal report-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header report-modal-header">
                    <div className="report-title-area">
                        <div className="report-title-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                        </div>
                        <div>
                            <h3>Download Report</h3>
                            <span className="report-subtitle">Export your habit data</span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="report-modal-body">
                    {/* Report Type Toggle */}
                    <div className="report-section">
                        <label className="report-section-label">Report Period</label>
                        <div className="report-type-toggle">
                            <button
                                className={`type-toggle-btn ${reportType === 'monthly' ? 'active' : ''}`}
                                onClick={() => setReportType('monthly')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                Monthly
                            </button>
                            <button
                                className={`type-toggle-btn ${reportType === 'yearly' ? 'active' : ''}`}
                                onClick={() => setReportType('yearly')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <path d="M2 17l10 5 10-5" />
                                    <path d="M2 12l10 5 10-5" />
                                </svg>
                                Yearly
                            </button>
                        </div>
                    </div>

                    {/* Period Selector */}
                    <div className="report-section">
                        <label className="report-section-label">Select Period</label>
                        <div className="period-selectors">
                            {reportType === 'monthly' && (
                                <select
                                    className="input period-select"
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(Number(e.target.value))}
                                >
                                    {MONTH_NAMES.map((name, idx) => (
                                        <option key={idx} value={idx}>{name}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                className="input period-select"
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                            >
                                {years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Stats Preview */}
                    <div className="report-section">
                        <label className="report-section-label">Preview — {periodLabel}</label>
                        <div className="report-stats-grid">
                            <div className="report-stat-card">
                                <div className="stat-value" style={{ color: 'var(--navy-300)' }}>
                                    {stats.completed}
                                </div>
                                <div className="stat-label">Total Completions</div>
                            </div>
                            <div className="report-stat-card">
                                <div className="stat-value" style={{
                                    color: stats.rate >= 70 ? 'var(--accent-success)' : stats.rate >= 40 ? 'var(--accent-gold)' : 'var(--accent-error)'
                                }}>
                                    {stats.rate}%
                                </div>
                                <div className="stat-label">Completion Rate</div>
                            </div>
                            <div className="report-stat-card">
                                <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>
                                    {tasks.length}
                                </div>
                                <div className="stat-label">Active Habits</div>
                            </div>
                        </div>
                        {stats.bestTask && (
                            <div className="report-highlight-row">
                                <span className="highlight-label">🏆 Best habit:</span>
                                <span className="highlight-value">{stats.bestTask.name}</span>
                                <span className="highlight-count">
                                    {stats.bestTask.count}/{stats.bestTask.possible} days
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Export Buttons */}
                    <div className="report-section">
                        <label className="report-section-label">Export Format</label>
                        <div className="export-buttons">
                            <button
                                className="export-btn export-csv"
                                onClick={handleExportCsv}
                                disabled={!!exporting || tasks.length === 0}
                            >
                                {exporting === 'csv' ? (
                                    <span className="export-spinner" />
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                )}
                                <div className="export-btn-text">
                                    <span className="export-btn-title">Export CSV</span>
                                    <span className="export-btn-desc">Spreadsheet data</span>
                                </div>
                            </button>

                            <button
                                className="export-btn export-pdf"
                                onClick={handleExportPdf}
                                disabled={!!exporting || tasks.length === 0}
                            >
                                {exporting === 'pdf' ? (
                                    <span className="export-spinner" />
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                )}
                                <div className="export-btn-text">
                                    <span className="export-btn-title">Print / PDF</span>
                                    <span className="export-btn-desc">Formatted report</span>
                                </div>
                            </button>
                        </div>

                        {tasks.length === 0 && (
                            <p className="export-empty-note">Add habits first to generate a report.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportModal;
