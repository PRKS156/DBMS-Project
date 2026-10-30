import React from 'react';

export default function TableControls({ label, state, setState, result, statuses }) {
  const update = patch => setState(previous => ({ ...previous, ...patch, page: 1 }));
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', margin: '16px 0' }}>
    <label>{label} search <input type="search" value={state.query} onChange={e => update({ query: e.target.value })} /></label>
    <label>Status <select value={state.status} onChange={e => update({ status: e.target.value })}>
      <option value="ALL">All</option>{statuses.map(status => <option key={status}>{status}</option>)}
    </select></label>
    <label>Rows <select value={state.size} onChange={e => update({ size: Number(e.target.value) })}>
      {[10, 25, 50].map(size => <option key={size}>{size}</option>)}
    </select></label>
    <button type="button" disabled={result.page <= 1} onClick={() => setState(previous => ({ ...previous, page: result.page - 1 }))}>Previous</button>
    <span aria-live="polite">{result.total} results · Page {result.page} of {result.pages}</span>
    <button type="button" disabled={result.page >= result.pages} onClick={() => setState(previous => ({ ...previous, page: result.page + 1 }))}>Next</button>
  </div>;
}
