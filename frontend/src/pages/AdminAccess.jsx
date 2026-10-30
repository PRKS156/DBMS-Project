import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';

export default function AdminAccess() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.role === 'ADMIN') {
        localStorage.clear();
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('name', 'Administrator');
        navigate('/admin-dashboard');
      } else {
        setError(data.error || 'Access denied. Administrator privileges required.');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <section className="card">
      <div className="heading">
        <span className="eyebrow">Administrative portal</span>
        <h1>System oversight.</h1>
        <p className="sub">Administrative credentials are required to view the live dispatch directory.</p>
      </div>
      <form className="form" onSubmit={handleLogin}>
        <div className="field">
          <label>Admin Email Address</label>
          <input type="email" placeholder="prakhar@vit.edu" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Administrative password</label>
          <input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button className="btn navy" type="submit">Open dashboard <span aria-hidden="true">→</span></button>
      </form>
      {/* Evaluator Quick Demo Login */}
      <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)', fontWeight: 600 }}>
          Evaluator Quick Access (Demo Mode)
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={async () => {
              setError('');
              try {
                const res = await fetch(`${API_BASE}/api/auth/demo-login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ role: 'ADMIN' })
                });
                const data = await res.json();
                if (res.ok) {
                  localStorage.clear();
                  localStorage.setItem('token', data.token);
                  localStorage.setItem('role', data.role);
                  localStorage.setItem('name', data.name || 'Chief Administrator');
                  localStorage.setItem('userId', data.userId);
                  navigate('/admin-dashboard');
                } else {
                  setError(data.error || 'Demo login failed');
                }
              } catch (e) { setError('Demo login failed'); }
            }}
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            ⚡ Quick Evaluator Login: Chief Administrator
          </button>
          <button
            type="button"
            onClick={async () => {
              setError('');
              try {
                const res = await fetch(`${API_BASE}/api/auth/demo-login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ role: 'ADMIN' })
                });
                const data = await res.json();
                if (res.ok) {
                  localStorage.clear();
                  localStorage.setItem('token', data.token);
                  localStorage.setItem('role', 'DISPATCHER');
                  localStorage.setItem('name', 'Regional Dispatch Controller');
                  localStorage.setItem('userId', data.userId);
                  navigate('/admin-dashboard');
                } else {
                  setError(data.error || 'Demo login failed');
                }
              } catch (e) { setError('Demo login failed'); }
            }}
            style={{
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid #a855f7',
              color: '#c084fc',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            ⚡ Quick Evaluator Login: Regional Dispatcher
          </button>
        </div>
      </div>
      {error && <div className="result error" style={{display:'block'}}>{error}</div>}
      <div className="screen-footer">
        <Link to="/" className="link back">Return to access options</Link>
      </div>
    </section>
  );
}
