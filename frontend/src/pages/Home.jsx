import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [loadingSOS, setLoadingSOS] = useState(false);
  const [sosStatus, setSosStatus] = useState(null);

  const handleGuestSOS = () => {
    setLoadingSOS(true);
    setSosStatus(null);
    if (!navigator.geolocation) {
      setSosStatus({ error: 'Geolocation not supported.' });
      setLoadingSOS(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch('https://emergency-backend-3ppk.onrender.com/api/alerts/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            requiredSpecialization: 'Unsure / General',
            locationType: 'Outside',
            landmark: 'Unknown Bystander SOS'
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
           setSosStatus({ success: true, message: '🚨 AMBULANCE DISPATCHED! They have your exact location and are en route.' });
        } else {
           setSosStatus({ error: data.message || 'Failed to dispatch.' });
        }
      } catch (err) {
         setSosStatus({ error: 'Network error. Call 911 immediately.' });
      } finally {
         setLoadingSOS(false);
      }
    }, () => {
      setSosStatus({ error: 'Location permission denied. Cannot dispatch.' });
      setLoadingSOS(false);
    });
  };

  return (
    <section className="card" aria-label="MedRelay emergency dispatch service">
      <div className="heading">
        <span className="eyebrow">Coordinated clinical response</span>
        <h1>Emergency care,<br />professionally dispatched.</h1>
        <p className="sub">MedRelay connects patients and caregivers with the nearest available clinician, matched by specialisation and proximity, at the moment care is required.</p>
      </div>
      
      <div className="panel" style={{ textAlign: 'center', backgroundColor: '#fff3cd', borderColor: '#ffeeba' }}>
        <h2 style={{ color: '#856404' }}>Critical Emergency?</h2>
        <p style={{ color: '#856404', marginBottom: '15px' }}>If someone is in immediate danger, use the One-Tap Guest SOS to dispatch an ambulance to your current GPS location. No account required.</p>
        
        {sosStatus && sosStatus.success ? (
          <div style={{ padding: '15px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '8px', fontWeight: 'bold' }}>
            {sosStatus.message}
          </div>
        ) : (
          <button 
            className="btn red" 
            style={{ width: '100%', padding: '15px', fontSize: '18px', fontWeight: 'bold' }} 
            onClick={handleGuestSOS} 
            disabled={loadingSOS}
          >
            {loadingSOS ? 'Locating...' : '🚨 ONE-TAP GUEST SOS'}
          </button>
        )}
        
        {sosStatus && sosStatus.error && (
          <div style={{ marginTop: '10px', color: 'red', fontWeight: 'bold' }}>
            {sosStatus.error}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: '20px' }}>
        <h2>Standard Access</h2>
        <p>Please select the access path that applies to you. Patient requests are routed to an available physician in real time and monitored until acknowledged.</p>
        <div className="panel-stats">
          <div className="panel-stat"><span>Median dispatch</span><strong>Under 60s</strong></div>
          <div className="panel-stat"><span>Location refresh</span><strong>Every 10s</strong></div>
          <div className="panel-stat"><span>Availability</span><strong>24 / 7</strong></div>
        </div>
      </div>
      
      <div className="roles">
        <Link to="/doctor" className="role" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="role-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v5a4 4 0 0 0 8 0V3"/>
              <path d="M6 21v-4a6 6 0 0 1 12 0v4"/>
              <path d="M12 12v9"/>
            </svg>
          </span>
          <span className="role-title">Medical professional</span>
          <span className="role-note">Manage your duty status and receive dispatch notifications.</span>
        </Link>
        
        <Link to="/patient" className="role alt" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="role-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 4h7l1.2 3H20a1 1 0 0 1 1 1v9.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5V8a1 1 0 0 1 1-1h3.3L8.5 4Z"/>
              <path d="M12 9v6M9 12h6"/>
              <path d="M6.5 20v-2M17.5 20v-2"/>
            </svg>
          </span>
          <span className="role-title">Patient or caregiver</span>
          <span className="role-note">Submit an urgent request to the nearest available care team.</span>
        </Link>
      </div>
      
      <div className="screen-footer">
        <span className="link" style={{ cursor: 'default' }}>Access is logged for clinical governance.</span>
        <Link to="/admin" className="link admin">Administrative portal</Link>
      </div>
    </section>
  );
}
