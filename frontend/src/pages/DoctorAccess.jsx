import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = 'https://emergency-backend-3ppk.onrender.com';

export default function DoctorAccess() {
  const [screen, setScreen] = useState('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('General Medicine');
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
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('name', data.name || email);
        localStorage.setItem('userId', data.userId);
        navigate('/doctor-dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'DOCTOR', name, phone, specialization })
      });
      const data = await res.json();
      if (res.ok) {
        setScreen('saved-id');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <section className="card">
      {screen === 'choice' && (
        <>
          <div className="heading">
            <span className="eyebrow">Clinical access</span>
            <h1>Join the response network.</h1>
            <p className="sub">Sign in to update your duty status, or create a professional profile to begin receiving dispatches.</p>
          </div>
          <div className="roles compact">
            <button className="role" type="button" onClick={() => setScreen('login')}>
              <span className="role-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              </span>
              <span className="role-title">Sign in</span>
              <span className="role-note">I already hold a clinician profile.</span>
            </button>
            <button className="role" type="button" onClick={() => setScreen('register')}>
              <span className="role-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 8v8M8 12h8"/></svg>
              </span>
              <span className="role-title">Register</span>
              <span className="role-note">Create a new professional profile.</span>
            </button>
          </div>
          <div className="screen-footer">
            <Link to="/" className="link back">Return to access options</Link>
          </div>
        </>
      )}

      {screen === 'login' && (
        <>
          <div className="heading">
            <span className="eyebrow">Clinical sign in</span>
            <h1>Welcome back, Doctor.</h1>
            <p className="sub">Sign in to your profile. You will remain invisible to dispatch until you explicitly commence duty.</p>
          </div>
          <form className="form" onSubmit={handleLogin}>
            <div className="field">
              <label>Email Address</label>
              <input type="email" placeholder="doctor@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn teal" type="submit">Sign in securely <span aria-hidden="true">→</span></button>
          </form>
          {error && <div className="result error" style={{display:'block'}}>{error}</div>}
          <div className="screen-footer">
            <button className="link back" style={{background:'none',border:'none'}} onClick={() => setScreen('choice')}>Return to clinical access</button>
          </div>
        </>
      )}

      {screen === 'register' && (
        <>
          <div className="heading">
            <span className="eyebrow">Professional registration</span>
            <h1>Establish your response profile.</h1>
            <p className="sub">Your location is used solely to match nearby emergency requests, and only while you have elected to be on duty.</p>
          </div>
          <form className="form" onSubmit={handleRegister}>
            <div className="field">
              <label>Email Address</label>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Full name</label>
              <input type="text" placeholder="Dr. Jane Smith" value={name} onChange={e => setName(e.target.value.replace(/[^A-Za-z. ]/g, ''))} required />
            </div>
            <div className="split">
              <div className="field">
                <label>Contact number <span className="hint">10 digits</span></label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 15px' }}>
                  <span style={{ color: 'var(--text-light)', fontWeight: '500' }}>+91</span>
                  <input type="tel" inputMode="numeric" placeholder="9876543210" maxLength="10" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))} required style={{ border: 'none', background: 'transparent', padding: '15px 0', width: '100%', outline: 'none' }} />
                </div>
              </div>
              <div className="field">
                <label>Clinical specialisation</label>
                <select value={specialization} onChange={e => setSpecialization(e.target.value)}>
                  <option>General Medicine</option><option>Cardiology</option><option>Trauma Surgery</option>
                  <option>Pediatrics</option><option>Orthopedics</option><option>Critical Care</option><option>Neurology</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Create password <span className="hint">Minimum 4 characters</span></label>
              <input type="password" placeholder="Choose a secure password" minLength="4" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn teal" type="submit">Create professional profile <span aria-hidden="true">→</span></button>
          </form>
          {error && <div className="result error" style={{display:'block'}}>{error}</div>}
          <div className="screen-footer">
            <button className="link back" style={{background:'none',border:'none'}} onClick={() => setScreen('choice')}>Return to clinical access</button>
          </div>
        </>
      )}

      {screen === 'saved-id' && (
        <>
           <div className="heading">
            <span className="eyebrow">Profile established</span>
            <h1>Your registration is complete.</h1>
            <p className="sub">Please use your email to sign in to access your duty settings.</p>
          </div>
          <button className="btn teal" onClick={() => setScreen('login')}>Proceed to login <span aria-hidden="true">→</span></button>
        </>
      )}
    </section>
  );
}
