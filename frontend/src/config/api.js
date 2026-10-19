/**
 * Centralized API and WebSocket Configuration for MedRelay Frontend
 */

export const API_BASE = (import.meta.env.VITE_API_BASE || 'https://emergency-backend-3ppk.onrender.com').replace(/\/+$/, '');
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_BASE).replace(/\/+$/, '');

export default {
  API_BASE,
  SOCKET_URL
};
