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
  const [adminStats, setAdminStats] = useState({ totalDoctors: 0, availableDoctors: 0, busyOrOffDuty: 0, totalPatients: 0 });
  const [doctorsList, setDoctorsList] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [doctorAlerts, setDoctorAlerts] = useState([]);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [activeAlertDetails, setActiveAlertDetails] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/');
    } else if (role === 'ADMIN') {
      fetchAdminStats();
    } else if (role === 'DOCTOR') {
      fetchDoctorAlerts();
      const interval = setInterval(fetchDoctorAlerts, 5000);
      return () => clearInterval(interval);
    }
  }, [token, navigate, role]);

  useEffect(() => {
    let interval;
    if (role === 'PATIENT' && activeAlertId) {
      const fetchStatus = async () => {
        try {
          const res = await fetch(`https://emergency-backend-3ppk.onrender.com/api/alerts/status/${activeAlertId}`);
          const data = await res.json();
          if (res.ok && data.success) {
            setActiveAlertDetails(data.alert);
          }
        } catch(err) { console.error(err); }
      };
      fetchStatus();
      interval = setInterval(fetchStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [role, activeAlertId]);

  useEffect(() => {
    let locationInterval;
    if (role === 'DOCTOR' && active) {
      locationInterval = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
              await fetch(`https://emergency-backend-3ppk.onrender.com/api/doctors/${localStorage.getItem('userId')}/location`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude
                })
              });
            } catch (err) { console.error(err); }
          });
        }
      }, 10000); // Update doctor's live location every 10 seconds
    }
    return () => clearInterval(locationInterval);
  }, [role, active]);

  const fetchDoctorAlerts = async () => {
    try {
      const res = await fetch(`https://emergency-backend-3ppk.onrender.com/api/alerts/doctor/${localStorage.getItem('userId')}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setDoctorAlerts(data.alerts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await fetch(`https://emergency-backend-3ppk.onrender.com/api/alerts/${alertId}/acknowledge`, { method: 'PATCH' });
      fetchDoctorAlerts();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const res = await fetch('https://emergency-backend-3ppk.onrender.com/api/admin/data');
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminStats(data.stats);
        setDoctorsList(data.doctors || []);
        setPatientsList(data.patients || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteAdminRecord = async (type, id) => {
    try {
      await fetch(`https://emergency-backend-3ppk.onrender.com/api/admin/${type}/${id}`, { method: 'DELETE' });
      fetchAdminStats();
    } catch (err) {
      console.error(err);
    }
  };

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
            <button className="btn-sm ghost" type="button" onClick={fetchAdminStats}>Refresh directory</button>
            <button className="btn-sm plain" type="button" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
        
        <div className="metrics">
          <div className="metric"><span>Registered clinicians</span><strong>{adminStats.totalDoctors}</strong></div>
          <div className="metric ok"><span>Currently available</span><strong>{adminStats.availableDoctors}</strong></div>
          <div className="metric busy"><span>Engaged or off duty</span><strong>{adminStats.busyOrOffDuty}</strong></div>
          <div className="metric"><span>Patient records</span><strong>{adminStats.totalPatients}</strong></div>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3>Registered Doctors</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', textAlign: 'left' }}>
            <thead><tr style={{ borderBottom: '1px solid #ddd' }}><th>Name</th><th>Email</th><th>Specialization</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {doctorsList.length === 0 ? <tr><td colSpan="5">No doctors registered.</td></tr> : doctorsList.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 0' }}>{d.name}</td><td>{d.email}</td><td>{d.specialization}</td>
                  <td>{d.isAvailable ? <span style={{color:'green'}}>Available</span> : <span style={{color:'red'}}>Off Duty</span>}</td>
                  <td><button className="btn-sm plain" onClick={() => deleteAdminRecord('doctors', d.userId)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3>Patient Records</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', textAlign: 'left' }}>
            <thead><tr style={{ borderBottom: '1px solid #ddd' }}><th>Name</th><th>Email</th><th>Age/Gender</th><th>Blood</th><th>Actions</th></tr></thead>
            <tbody>
              {patientsList.length === 0 ? <tr><td colSpan="5">No patients registered.</td></tr> : patientsList.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 0' }}>{p.name}</td><td>{p.email}</td><td>{p.age} / {p.gender}</td><td>{p.bloodGroup}</td>
                  <td><button className="btn-sm plain" onClick={() => deleteAdminRecord('patients', p.userId)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <div className="alerts-head"><h3>Assigned emergency requests</h3><span className="count-pill">{doctorAlerts.length} active</span></div>
            
            {doctorAlerts.length === 0 ? (
              <div className="empty-note">No requests have been assigned to you at this time. This view refreshes automatically.</div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem'}}>
                {doctorAlerts.map(alert => (
                  <div key={alert.alertid} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <strong>{alert.patientname} ({alert.age}y, {alert.gender}) - Blood: {alert.bloodgroup}</strong>
                      <span className="count-pill" style={{backgroundColor: alert.status === 'PENDING' ? '#ffeb3b' : '#c8e6c9', color: '#000'}}>{alert.status}</span>
                    </div>
                    <p style={{ margin: '0 0 10px 0' }}><strong>Location:</strong> {alert.description}</p>
                    <p style={{ margin: '0 0 15px 0' }}><strong>Contact:</strong> {alert.patientphone}</p>
                    {alert.status === 'PENDING' && (
                      <button className="btn teal" onClick={() => acknowledgeAlert(alert.alertid)}>Acknowledge En Route</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
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
            if (data.alertId) {
              setActiveAlertId(data.alertId);
            }
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

        {activeAlertId && activeAlertDetails ? (
          <div style={{ padding: '20px', border: '2px solid var(--primary)', borderRadius: '12px', backgroundColor: '#f0fdf4' }}>
            <h3 style={{ color: 'var(--primary)', margin: '0 0 15px 0' }}>Dispatched Clinician En Route</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div><strong>Physician:</strong><br/>{activeAlertDetails.doctorname}</div>
              <div><strong>Specialization:</strong><br/>{activeAlertDetails.specialization}</div>
              <div><strong>Contact:</strong><br/>{activeAlertDetails.doctorphone}</div>
              <div><strong>Distance:</strong><br/>{activeAlertDetails.distanceFormatted} away</div>
            </div>
            
            <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', backgroundColor: activeAlertDetails.status === 'PENDING' ? '#fff3cd' : '#d4edda' }}>
              <strong>Status: </strong>
              {activeAlertDetails.status === 'PENDING' 
                ? 'Physician has been dispatched. Waiting for them to acknowledge the alert...' 
                : '✅ Physician has acknowledged the alert and is actively en route to your location!'}
            </div>
            <button className="btn plain" style={{marginTop: '20px', width: '100%', textAlign: 'center'}} onClick={() => {setActiveAlertId(null); setActiveAlertDetails(null); setSuccess('');}}>Cancel or submit new request</button>
          </div>
        ) : (
          <>
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
          </>
        )}
        
        <div className="screen-footer">
          <button className="link back" style={{background:'none', border:'none'}} onClick={handleLogout}>Sign out</button>
        </div>
      </section>
    );
  }

  return null;
}
