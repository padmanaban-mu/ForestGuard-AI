import Papa from 'papaparse';
export function downloadCsv(rows, filename = 'forestguard-export.csv') {
  if (!Array.isArray(rows) || !rows.length) return false;
  const csv = Papa.unparse(rows, { quotes: true, newline: '\r\n' });
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); return true;
}
