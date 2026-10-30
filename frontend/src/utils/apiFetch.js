import { API_BASE } from '../config/api';
export function installApiFetch() {
 const original = window.fetch.bind(window);
 window.fetch = (input, options = {}) => {
  const url = new URL(input instanceof Request ? input.url : input, window.location.href);
  if (url.origin !== new URL(API_BASE).origin || !url.pathname.startsWith('/api/')) return original(input, options);
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(options.headers).forEach((v,k)=>headers.set(k,v));
  const token = localStorage.getItem('token');
  if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer '+token);
  const tracking = new URLSearchParams(window.location.search).get('token') || localStorage.getItem('activeTrackingToken');
  if (tracking) headers.set('X-Tracking-Token', tracking);
  return original(input, {...options, headers});
 };
}
