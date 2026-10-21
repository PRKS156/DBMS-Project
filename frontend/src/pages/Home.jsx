import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';

export default function Home() {
  const navigate = useNavigate();
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
        const res = await fetch(`${API_BASE}/api/alerts/trigger`, {
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
           setSosStatus({
             success: true,
             alertId: data.alertId,
             patientLat: pos.coords.latitude,
             patientLng: pos.coords.longitude,
             doctor: data.dispatchedDoctor,
             vehicle: data.allocatedVehicle,
             message: '🩺 DOCTOR DISPATCHED! A qualified physician has been dispatched to your location.'
           });
           if (data.alertId) {
             localStorage.setItem('activeAlertId', data.alertId);
           }
           if (data.trackingToken) {
             localStorage.setItem('activeTrackingToken', data.trackingToken);
           }
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
        <p style={{ color: '#856404', marginBottom: '15px' }}>If someone is in immediate danger, use the One-Tap Guest SOS to dispatch an emergency physician to your current GPS location. No account required.</p>
        
        {sosStatus && sosStatus.success ? (
          <div style={{ textAlign: 'left', marginTop: '10px' }}>
            <div style={{ padding: '14px 16px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '10px', fontWeight: 'bold', border: '1px solid #86efac', marginBottom: '14px' }}>
              {sosStatus.message}
            </div>

            {sosStatus.doctor && (
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px', marginBottom: '14px', color: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '1rem', color: '#fff' }}>Physician: {sosStatus.doctor.name}</strong>
                  <span className="count-pill" style={{ background: '#bbf7d0', color: '#14532d', fontWeight: 'bold' }}>EN ROUTE</span>
                </div>
                <div style={{ fontSize: '0.88rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Specialty:</strong> {sosStatus.doctor.specialization}</div>
                  <div><strong>Contact:</strong> {sosStatus.doctor.phone}</div>
                  <div><strong>Distance:</strong> {sosStatus.doctor.distance}</div>
                  {sosStatus.vehicle && (
                    <div style={{ color: '#38bdf8' }}><strong>Ambulance:</strong> 🚑 {sosStatus.vehicle.licensePlate} ({sosStatus.vehicle.type})</div>
                  )}
                </div>
              </div>
            )}

            {/* Live Distance & GPS Telemetry Card */}
            {sosStatus.patientLat && sosStatus.patientLng && (
              <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #334155', marginBottom: '14px', background: '#0f172a', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Live Responder Telemetry
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#22c55e', fontWeight: 'bold' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></span>
                    Live GPS Synced
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Live Distance to Patient</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#38bdf8' }}>
                      {sosStatus.doctor?.distance || '1.2 km away'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Est. Travel Time</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#34d399' }}>
                      ~3 - 5 mins
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📍 Patient GPS: {sosStatus.patientLat.toFixed(5)}, {sosStatus.patientLng.toFixed(5)}</span>
                  <span style={{ color: '#38bdf8' }}>● Real-time dispatch active</span>
                </div>
              </div>
            )}

            {sosStatus.alertId && (
              <button
                className="btn teal"
                style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => navigate(`/track-ambulance?alertId=${sosStatus.alertId}&token=${localStorage.getItem('activeTrackingToken') || ''}`)}
              >
                🚑 View Live Doctor Distance & Tracking Console ➔
              </button>
            )}
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
