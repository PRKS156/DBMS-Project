/**
 * Centralized API and WebSocket Configuration for MedRelay Frontend
 */

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const storedBase = typeof window !== 'undefined' ? localStorage.getItem('medrelay_api_base') : null;

export const API_BASE = (
  storedBase ||
  (isLocalhost ? (import.meta.env?.VITE_LOCAL_API_BASE || 'http://localhost:3000') : (import.meta.env?.VITE_API_BASE || 'https://emergency-backend-3ppk.onrender.com')) || 'http://localhost:3000'
).replace(/\/+$/, '');

export const SOCKET_URL = (import.meta.env?.VITE_SOCKET_URL || API_BASE).replace(/\/+$/, '');


export default {
  API_BASE,
  SOCKET_URL
};
