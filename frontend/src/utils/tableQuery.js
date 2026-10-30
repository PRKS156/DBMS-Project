export function queryRows(rows, query, status, page, pageSize = 10) {
  const term = query.trim().toLowerCase();
  const filtered = rows.filter(row => (!term || Object.values(row).some(value =>
    value != null && typeof value !== 'object' && String(value).toLowerCase().includes(term))) &&
    (status === 'ALL' || (row.status || (row.isActive === false ? 'INACTIVE' : 'ACTIVE')) === status));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return { rows: filtered.slice((current - 1) * pageSize, current * pageSize), total: filtered.length, pages, page: current };
}
