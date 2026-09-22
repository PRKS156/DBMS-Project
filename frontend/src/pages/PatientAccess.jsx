import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = 'https://emergency-backend-3ppk.onrender.com';

export default function PatientAccess() {
  const [screen, setScreen] = useState('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('A+');
  const [phone, setPhone] = useState('');
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
        localStorage.setItem('name', email);
        navigate('/patient-dashboard');
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
        body: JSON.stringify({ email, password, role: 'PATIENT', name, age, gender, bloodGroup, phone })
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
            <span className="eyebrow">Patient access</span>
            <h1>Request medical assistance.</h1>
            <p className="sub">Sign in with your existing patient record, or complete a one-time registration to begin.</p>
          </div>
          <div className="roles compact">
            <button className="role" type="button" onClick={() => setScreen('login')}>
              <span className="role-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              </span>
              <span className="role-title">Sign in</span>
              <span className="role-note">I already hold a patient record.</span>
            </button>
            <button className="role alt" type="button" onClick={() => setScreen('register')}>
              <span className="role-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 8v8M8 12h8"/></svg>
              </span>
              <span className="role-title">Register</span>
              <span className="role-note">Create a new patient care record.</span>
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
            <span className="eyebrow">Patient sign in</span>
            <h1>Welcome back.</h1>
            <p className="sub">Please enter the email and password issued to you at registration.</p>
          </div>
          <form className="form" onSubmit={handleLogin}>
            <div className="field">
              <label>Email Address</label>
              <input type="email" placeholder="patient@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn red" type="submit">Sign in securely <span aria-hidden="true">→</span></button>
          </form>
          {error && <div className="result error" style={{display:'block'}}>{error}</div>}
          <div className="screen-footer">
            <button className="link back" style={{background:'none',border:'none'}} onClick={() => setScreen('choice')}>Return to patient access</button>
          </div>
        </>
      )}

      {screen === 'register' && (
        <>
          <div className="heading">
            <span className="eyebrow">Patient registration</span>
            <h1>Create your care record.</h1>
            <p className="sub">Register once so that emergency assistance can be requested whenever it is required.</p>
          </div>
          <form className="form" onSubmit={handleRegister}>
            <div className="field">
              <label>Email Address</label>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Full name</label>
              <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="split">
              <div className="field">
                <label>Age</label>
                <input type="number" placeholder="34" value={age} onChange={e => setAge(e.target.value)} required />
              </div>
              <div className="field">
                <label>Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
            </div>
            <div className="split">
               <div className="field">
                <label>Blood group</label>
                <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
                  <option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>O+</option><option>O-</option><option>AB+</option><option>AB-</option>
                </select>
              </div>
              <div className="field">
                <label>Contact number</label>
                <input type="tel" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label>Create password</label>
              <input type="password" placeholder="Choose a secure password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn red" type="submit">Create patient record <span aria-hidden="true">→</span></button>
          </form>
          {error && <div className="result error" style={{display:'block'}}>{error}</div>}
          <div className="screen-footer">
            <button className="link back" style={{background:'none',border:'none'}} onClick={() => setScreen('choice')}>Return to patient access</button>
          </div>
        </>
      )}

      {screen === 'saved-id' && (
        <>
           <div className="heading">
            <span className="eyebrow">Registration complete</span>
            <h1>Your patient record is active.</h1>
            <p className="sub">Please use your email to sign in for emergency requests.</p>
          </div>
          <button className="btn red" onClick={() => setScreen('login')}>Proceed to login <span aria-hidden="true">→</span></button>
        </>
      )}
    </section>
  );
}
