import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const [active, setActive] = useState(false);

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
            <button className="btn teal" type="button" onClick={() => setActive(true)}><span aria-hidden="true">●</span> Commence on-duty session</button>
          </>
        ) : (
          <>
            <div className="duty">Your location is being shared with the dispatch system.</div>
            <div className="alerts-head"><h3>Assigned emergency requests</h3><span className="count-pill">0 active</span></div>
            <div className="empty-note">No requests have been assigned to you at this time. This view refreshes automatically.</div>
            <button className="btn navy" type="button" onClick={() => setActive(false)}>Conclude on-duty session</button>
          </>
        )}
        
        <div className="screen-footer">
          <button className="link back" style={{background:'none', border:'none'}} onClick={handleLogout}>Sign out</button>
        </div>
      </section>
    );
  }

  if (role === 'PATIENT') {
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
            <select>
              <optgroup label="Common presentations">
                <option>Cardiac emergency</option>
                <option>Severe injury or accident</option>
              </optgroup>
              <option>Uncertain — please assess</option>
            </select>
          </div>
          <p className="caption">Where known, please provide your on-site location so that the attending clinician can reach you without delay.</p>
          <div className="split">
            <div className="field"><label>Floor</label><input type="text" placeholder="Third floor" /></div>
            <div className="field"><label>Room</label><input type="text" placeholder="Room 312" /></div>
          </div>
        </div>
        <button className="btn red" type="button">Submit emergency request <span aria-hidden="true">→</span></button>
        <div className="screen-footer">
          <button className="link back" style={{background:'none', border:'none'}} onClick={handleLogout}>Sign out</button>
        </div>
      </section>
    );
  }

  return null;
}
