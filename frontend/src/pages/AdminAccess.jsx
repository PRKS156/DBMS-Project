import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = 'https://emergency-backend-3ppk.onrender.com';

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
          <input type="email" placeholder="admin@vit.edu" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Administrative password</label>
          <input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button className="btn navy" type="submit">Open dashboard <span aria-hidden="true">→</span></button>
      </form>
      {error && <div className="result error" style={{display:'block'}}>{error}</div>}
      <div className="screen-footer">
        <Link to="/" className="link back">Return to access options</Link>
      </div>
    </section>
  );
}
