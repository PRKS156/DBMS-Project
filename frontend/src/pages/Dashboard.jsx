import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const [active, setActive] = useState(false);
  const [emergencyType, setEmergencyType] = useState('Unsure / General');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  if (role === 'ADMIN') {
    return (
      <section className="card wide screen active">
        <div className="dash-top">
          <div>
            <span className="eyebrow">Administrative portal</span>
            <h1>Dispatch directory</h1>
            <p className="sub">A current view of registered clinicians and patient records held by the service.</p>
          </div>
          <div className="dash-actions">
            <button className="btn-sm ghost" type="button">Refresh directory</button>
            <button className="btn-sm plain" type="button" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
        
        <div className="metrics">
          <div className="metric"><span>Registered clinicians</span><strong>0</strong></div>
          <div className="metric ok"><span>Currently available</span><strong>0</strong></div>
          <div className="metric busy"><span>Engaged or off duty</span><strong>0</strong></div>
          <div className="metric"><span>Patient records</span><strong>0</strong></div>
        </div>
      </section>
    );
  }

  if (role === 'DOCTOR') {
    const handleDutyToggle = (goOnDuty) => {
      if (goOnDuty) {
        if (!navigator.geolocation) {
          setError('Geolocation is not supported by your browser.');
          return;
        }
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const res = await fetch(`https://emergency-backend-3ppk.onrender.com/api/doctors/${localStorage.getItem('userId')}/location`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
              })
            });
            if (res.ok) setActive(true);
          } catch (err) {
            console.error(err);
          }
        });
      } else {
        // Go off duty
        fetch(`https://emergency-backend-3ppk.onrender.com/api/doctors/${localStorage.getItem('userId')}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: false })
        }).then(() => setActive(false));
      }
    };

    return (
      <section className="screen active card">
        <div className="heading">
          <span className="eyebrow">{active ? 'Live for dispatch' : 'Duty settings'}</span>
          <h1>{active ? 'You are currently on duty.' : `Welcome, Dr. ${localStorage.getItem('name') || ''}.`}</h1>
          <p className="sub">{active ? 'Your availability and location are being securely transmitted to the dispatch service.' : 'You are signed in but are not currently receiving emergency dispatches.'}</p>
        </div>
        
        {!active ? (
          <>
            <div className="checklist">
              <h3>Before commencing duty</h3>
              <ul>
                <li>Grant location access so that proximity-based dispatch can operate accurately.</li>
                <li>Enable notifications to receive urgent alerts while this tab is closed.</li>
                <li>Remain available until you formally conclude your on-duty session.</li>
              </ul>
            </div>
            <button className="btn teal" type="button" onClick={() => handleDutyToggle(true)}><span aria-hidden="true">●</span> Commence on-duty session</button>
          </>
        ) : (
          <>
            <div className="duty">Your location is being shared with the dispatch system.</div>
            <div className="alerts-head"><h3>Assigned emergency requests</h3><span className="count-pill">0 active</span></div>
            <div className="empty-note">No requests have been assigned to you at this time. This view refreshes automatically.</div>
            <button className="btn navy" type="button" onClick={() => handleDutyToggle(false)}>Conclude on-duty session</button>
          </>
        )}
        
        <div className="screen-footer">
          <button className="link back" style={{background:'none', border:'none'}} onClick={handleLogout}>Sign out</button>
        </div>
      </section>
    );
  }

  if (role === 'PATIENT') {
    const handleEmergencySubmit = () => {
      setLoading(true);
      setError('');
      setSuccess('');
      
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.');
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const res = await fetch('https://emergency-backend-3ppk.onrender.com/api/alerts/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientId: parseInt(localStorage.getItem('userId')),
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              requiredSpecialization: emergencyType,
              floor,
              roomNumber: room
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setSuccess(data.message);
          } else {
            setError(data.message || 'Failed to dispatch.');
          }
        } catch (err) {
          setError('Failed to connect to the dispatch network.');
        } finally {
          setLoading(false);
        }
      }, () => {
        setError('Location permission denied. Cannot dispatch emergency services.');
        setLoading(false);
      });
    };

    return (
      <section className="screen active card">
        <div className="heading">
          <span className="eyebrow">Emergency request</span>
          <h1>Assistance is one request away.</h1>
          <p className="sub">Welcome back. Please confirm the nature of the emergency and your on-site location.</p>
        </div>
        <div className="form">
          <div className="field">
            <label>Nature of the emergency</label>
            <select value={emergencyType} onChange={e => setEmergencyType(e.target.value)}>
              <optgroup label="Common presentations">
                <option value="Cardiology">Cardiac emergency</option>
                <option value="Trauma Surgery">Severe injury or accident</option>
                <option value="Pediatrics">Pediatric emergency</option>
                <option value="Orthopedics">Bone or joint injury</option>
              </optgroup>
              <option value="Unsure / General">Uncertain — please assess</option>
            </select>
          </div>
          <p className="caption">Where known, please provide your on-site location so that the attending clinician can reach you without delay.</p>
          <div className="split">
            <div className="field"><label>Floor</label><input type="text" placeholder="Third floor" value={floor} onChange={e => setFloor(e.target.value)} /></div>
            <div className="field"><label>Room</label><input type="text" placeholder="Room 312" value={room} onChange={e => setRoom(e.target.value)} /></div>
          </div>
        </div>
        <button className="btn red" type="button" onClick={handleEmergencySubmit} disabled={loading}>
          {loading ? 'Transmitting...' : 'Submit emergency request'} <span aria-hidden="true">→</span>
        </button>
        {error && <div className="result error" style={{display:'block', marginTop: '15px'}}>{error}</div>}
        {success && <div className="result success" style={{display:'block', marginTop: '15px'}}>{success}</div>}
        <div className="screen-footer">
          <button className="link back" style={{background:'none', border:'none'}} onClick={handleLogout}>Sign out</button>
        </div>
      </section>
    );
  }

  return null;
}
