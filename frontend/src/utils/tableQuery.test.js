import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryRows } from './tableQuery.js';
test('search and status combine before pagination', () => {
  const rows = Array.from({ length: 31 }, (_, id) => ({ id, name: 'Doctor Test', status: id % 2 ? 'PENDING' : 'DISPATCHED' }));
  const result = queryRows(rows, ' TEST ', 'PENDING', 2, 10);
  assert.equal(result.total, 15);
  assert.equal(result.rows.length, 5);
  assert.equal(result.rows[0].id, 21);
});
test('live removals clamp the page and empty results remain navigable', () => {
  assert.equal(queryRows([{ id: 1 }], '', 'ALL', 9).page, 1);
  assert.deepEqual(queryRows([], '', 'ALL', 9).rows, []);
  assert.equal(queryRows([{ isActive: false }], '', 'INACTIVE', 1).total, 1);
});
