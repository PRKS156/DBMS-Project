import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import L from 'leaflet';

function FitBounds({ p1, p2 }) {
  const map = useMap();
  useEffect(() => {
    if (p1 && p2 && p1[0] && p1[1] && p2[0] && p2[1]) {
      const bounds = L.latLngBounds([p1, p2]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (p1 && p1[0] && p1[1]) {
      map.setView(p1, 15);
    }
  }, [p1, p2, map]);
  return null;
}

const patientIcon = L.divIcon({
  className: 'custom-patient-marker',
  html: `<div style="background:#ef4444; width:34px; height:34px; border-radius:50%; border:3px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px rgba(239,68,68,0.8);"><span style="font-size:16px;">🆘</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18]
});

const doctorIcon = L.divIcon({
  className: 'custom-doctor-marker',
  html: `<div style="background:#0ea5e9; width:34px; height:34px; border-radius:50%; border:3px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px rgba(14,165,233,0.8);"><span style="font-size:16px;">🩺</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18]
});

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const [active, setActive] = useState(false);
  const [emergencyType, setEmergencyType] = useState('Unsure / General');
  const [locationType, setLocationType] = useState('Outside');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [landmark, setLandmark] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminStats, setAdminStats] = useState({ totalDoctors: 0, availableDoctors: 0, busyOrOffDuty: 0, totalPatients: 0 });
  const [doctorsList, setDoctorsList] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [doctorAlerts, setDoctorAlerts] = useState([]);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [activeAlertDetails, setActiveAlertDetails] = useState(null);
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [doctorLoc, setDoctorLoc] = useState(null);
  const [docCoords, setDocCoords] = useState(null);
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!token) {
      navigate('/');
    } else if (role === 'ADMIN') {
      fetchAdminStats();
      fetchAdminAnalytics();
    } else if (role === 'DOCTOR') {
      fetchDoctorAlerts();
      const interval = setInterval(fetchDoctorAlerts, 4000);
      return () => clearInterval(interval);
    }

    if (role === 'PATIENT') {
      socketRef.current = io('https://emergency-backend-3ppk.onrender.com');
      socketRef.current.on('alertUpdate', (data) => {
        if (data.status === 'DISPATCHED') {
          setActiveAlertDetails(prev => prev ? { ...prev, status: 'DISPATCHED' } : prev);
        } else if (data.status === 'COMPLETED') {
          setActiveAlertDetails(prev => prev ? { ...prev, status: 'COMPLETED' } : prev);
        }
      });

      // Restore active alert on mount if patient had an emergency in progress
      const restoreActive = async () => {
        try {
          const res = await fetch(`https://emergency-backend-3ppk.onrender.com/api/alerts/patient/${localStorage.getItem('userId')}/active`);
          const data = await res.json();
          if (res.ok && data.success && data.alert) {
            setActiveAlertId(data.alert.alertid);
            setActiveAlertDetails(data.alert);
            if (data.alert.doctorLat && data.alert.doctorLng) {
              setDoctorLoc({ latitude: parseFloat(data.alert.doctorLat), longitude: parseFloat(data.alert.doctorLng) });
            }
          }
        } catch(e) { console.error(e); }
      };
      restoreActive();

      return () => socketRef.current && socketRef.current.disconnect();
    }
  }, [token, navigate, role]);

  useEffect(() => {
    if (role === 'PATIENT' && activeAlertId && socketRef.current) {
      socketRef.current.emit('joinAlertRoom', activeAlertId);
      socketRef.current.on(`doctorLocation`, (loc) => {
         setDoctorLoc({ latitude: parseFloat(loc.latitude), longitude: parseFloat(loc.longitude) });
      });
    }
  }, [role, activeAlertId]);

  useEffect(() => {
    let interval;
    if (role === 'PATIENT' && activeAlertId) {
      const fetchStatus = async () => {
        try {
          const res = await fetch(`https://emergency-backend-3ppk.onrender.com/api/alerts/${activeAlertId}/status`);
          const data = await res.json();
          if (res.ok && data.success && data.alert) {
            setActiveAlertDetails(data.alert);
            if (data.alert.doctorLat && data.alert.doctorLng) {
              setDoctorLoc({
                latitude: parseFloat(data.alert.doctorLat),
                longitude: parseFloat(data.alert.doctorLng)
              });
            }
            if (data.alert.doctorId && socketRef.current) {
              socketRef.current.on(`doctorLocation_${data.alert.doctorId}`, (loc) => {
                setDoctorLoc({ latitude: parseFloat(loc.latitude), longitude: parseFloat(loc.longitude) });
              });
            }
          }
        } catch(err) { console.error(err); }
      };
      fetchStatus();
      interval = setInterval(fetchStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [role, activeAlertId]);

  // Continuous high-accuracy GPS tracking for Doctor on Duty
  useEffect(() => {
    if (role === 'DOCTOR' && active) {
      const updateLocation = async (lat, lng) => {
        setDocCoords({ latitude: lat, longitude: lng });
        try {
          await fetch(`https://emergency-backend-3ppk.onrender.com/api/doctors/${localStorage.getItem('userId')}/location`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: lat, longitude: lng })
          });
        } catch (err) { console.error(err); }
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          updateLocation(pos.coords.latitude, pos.coords.longitude);
        });

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
          (err) => console.warn(err),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      }
    } else {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [role, active]);

  const fetchDoctorAlerts = async () => {
    try {
      const res = await fetch(`https://emergency-backend-3ppk.onrender.com/api/alerts/doctor/${localStorage.getItem('userId')}`);
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.alerts && data.alerts.length > 0) {
          setDoctorAlerts(prev => {
            const prevDispatched = new Set(prev.filter(p => p.status === 'DISPATCHED').map(p => p.alertid));
            return data.alerts.map(a => prevDispatched.has(a.alertid) ? { ...a, status: 'DISPATCHED' } : a);
          });
        } else {
          setDoctorAlerts(prev => prev.filter(a => a.status === 'DISPATCHED'));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      setDoctorAlerts(prev => prev.map(a => a.alertid === alertId ? { ...a, status: 'DISPATCHED' } : a));
      await fetch(`https://emergency-backend-3ppk.onrender.com/api/alerts/${alertId}/acknowledge`, { method: 'PATCH' });
    } catch (err) {
      console.error(err);
    }
  };

  const completeAlert = async (alertId) => {
    try {
      setDoctorAlerts(prev => prev.filter(a => a.alertid !== alertId));
      await fetch(`https://emergency-backend-3ppk.onrender.com/api/alerts/${alertId}/complete`, { method: 'PATCH' });
      fetchDoctorAlerts();
    } catch (err) {
      console.error(err);
      setDoctorAlerts(prev => prev.filter(a => a.alertid !== alertId));
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

  const fetchAdminAnalytics = async () => {
    try {
      const res = await fetch('https://emergency-backend-3ppk.onrender.com/api/admin/analytics');
      const data = await res.json();
      if (res.ok && data.success) setAdminAnalytics(data);
    } catch (err) { console.error(err); }
  };

  const deleteAdminRecord = async (type, id) => {
    const label = type === 'doctors' ? 'doctor' : 'patient';
    if (!window.confirm(`Are you sure you want to remove this ${label}?`)) {
      return;
    }
    try {
      const res = await fetch(`https://emergency-backend-3ppk.onrender.com/api/admin/${type}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        if (type === 'patients') {
          setPatientsList(prev => prev.filter(p => p.userId !== id && p.id !== id));
        } else if (type === 'doctors') {
          setDoctorsList(prev => prev.filter(d => d.userId !== id && d.id !== id));
        }
        fetchAdminStats();
      } else {
        alert(data.message || `Failed to remove ${label}: ${data.debug || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Network error while removing ${label}.`);
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

        {adminAnalytics && (
          <div style={{ marginTop: '3rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h2>System Analytics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
              <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
                <h3>Outdoor Emergencies by Area</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={adminAnalytics.areaCases} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={180} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Bar dataKey="cases" fill="#0088FE" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
                <h3>Emergency Types</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={adminAnalytics.emergencyTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {adminAnalytics.emergencyTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bedcd4' }}>
              <strong>Average Dispatch Response Time: </strong> {adminAnalytics.avgResponseTimeSeconds} seconds
            </div>
          </div>
        )}

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
              <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem'}}>
                {doctorAlerts.map(alert => {
                  const patientPos = (alert.latitude && alert.longitude)
                    ? [parseFloat(alert.latitude), parseFloat(alert.longitude)]
                    : (docCoords 
                        ? [docCoords.latitude + 0.002, docCoords.longitude + 0.002] 
                        : [12.9719, 79.1654]);
                  const docPos = docCoords 
                    ? [docCoords.latitude, docCoords.longitude] 
                    : (alert.doctorLat && alert.doctorLng 
                        ? [parseFloat(alert.doctorLat), parseFloat(alert.doctorLng)] 
                        : (patientPos ? [patientPos[0] - 0.002, patientPos[1] - 0.002] : [12.9700, 79.1630]));
                  return (
                    <div key={alert.alertid} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <strong style={{ fontSize: '1.05rem' }}>{alert.patientname} ({alert.age || '?'}y, {alert.gender || 'N/A'}) - Blood: {alert.bloodgroup || 'N/A'}</strong>
                        <span className="count-pill" style={{
                          backgroundColor: alert.status === 'PENDING' ? '#fef08a' : '#bbf7d0',
                          color: alert.status === 'PENDING' ? '#854d0e' : '#14532d',
                          fontWeight: '600'
                        }}>
                          {alert.status === 'PENDING' ? '⚡ PENDING ACKNOWLEDGMENT' : '🩺 EN ROUTE (DISPATCHED)'}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 6px 0' }}><strong>📍 Location details:</strong> {alert.description}</p>
                      <p style={{ margin: '0 0 6px 0' }}><strong>📋 Medical History:</strong> {alert.medicalHistory || 'None provided'}</p>
                      <p style={{ margin: '0 0 12px 0' }}><strong>📞 Contact:</strong> {alert.patientphone}</p>

                      {/* Embedded Doctor -> Patient Live Navigation Map */}
                      {patientPos && (
                        <div style={{ margin: '14px 0', borderRadius: '10px', overflow: 'hidden', border: '1px solid #334155' }}>
                          <div style={{ height: '220px', width: '100%' }}>
                            <MapContainer
                              center={patientPos}
                              zoom={15}
                              style={{ height: '100%', width: '100%' }}
                              zoomControl={true}
                            >
                              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                              <FitBounds p1={patientPos} p2={docPos} />
                              <Marker position={patientPos} icon={patientIcon}>
                                <Popup>Patient Location: {alert.patientname}</Popup>
                              </Marker>
                              {docPos && (
                                <>
                                  <Marker position={docPos} icon={doctorIcon}>
                                    <Popup>Your Location (Doctor)</Popup>
                                  </Marker>
                                  <Polyline positions={[docPos, patientPos]} color="#0ea5e9" dashArray="6, 8" />
                                </>
                              )}
                            </MapContainer>
                          </div>
                          <div style={{ padding: '8px 12px', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                            <span style={{ color: '#94a3b8' }}>GPS: {Number(patientPos[0]).toFixed(5)}, {Number(patientPos[1]).toFixed(5)}</span>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${patientPos[0]},${patientPos[1]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              🧭 Open Google Maps Navigation ↗
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        {alert.status === 'PENDING' && (
                          <button className="btn teal" style={{ flex: 1 }} onClick={() => acknowledgeAlert(alert.alertid)}>
                            🚨 Accept & Start En Route
                          </button>
                        )}
                        {alert.status === 'DISPATCHED' && (
                          <button className="btn" style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none' }} onClick={() => completeAlert(alert.alertid)}>
                            ✅ Mark Arrived / Complete Mission
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <button className="btn navy" type="button" onClick={() => handleDutyToggle(false)}>Go off duty</button>
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
              locationType,
              floor: locationType === 'Building' ? floor : undefined,
              roomNumber: locationType === 'Building' ? room : undefined,
              landmark: landmark
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
          <span className="eyebrow">Need Help?</span>
          <h1>Get help right now.</h1>
          <p className="sub">Tell us what's wrong and where you are, and we'll send a doctor immediately.</p>
        </div>

        {activeAlertId && activeAlertDetails ? (
          <div style={{ padding: '20px', border: '2px solid var(--primary)', borderRadius: '12px', backgroundColor: '#f0fdf4', color: '#0f2a31' }}>
            <h3 style={{ color: 'var(--primary)', margin: '0 0 15px 0' }}>Doctor is on the way</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div><strong>Doctor:</strong><br/>{activeAlertDetails.doctorname}</div>
                <div><strong>Specialty:</strong><br/>{activeAlertDetails.specialization}</div>
                <div><strong>Phone:</strong><br/>{activeAlertDetails.doctorphone}</div>
                <div><strong>Distance:</strong><br/>{activeAlertDetails.distanceFormatted} away</div>
              </div>
              <div style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #bedcd4' }}>
                <MapContainer
                  center={[activeAlertDetails.latitude || 0, activeAlertDetails.longitude || 0]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds
                    p1={[activeAlertDetails.latitude, activeAlertDetails.longitude]}
                    p2={doctorLoc ? [doctorLoc.latitude, doctorLoc.longitude] : null}
                  />
                  <Marker position={[activeAlertDetails.latitude || 0, activeAlertDetails.longitude || 0]} icon={patientIcon}>
                    <Popup>Your Location</Popup>
                  </Marker>
                  {doctorLoc && (
                    <>
                      <Marker position={[doctorLoc.latitude, doctorLoc.longitude]} icon={doctorIcon}>
                        <Popup>Doctor: {activeAlertDetails.doctorname} (Live)</Popup>
                      </Marker>
                      <Polyline
                        positions={[
                          [activeAlertDetails.latitude, activeAlertDetails.longitude],
                          [doctorLoc.latitude, doctorLoc.longitude]
                        ]}
                        color="#0ea5e9"
                        dashArray="6, 8"
                      />
                    </>
                  )}
                </MapContainer>
              </div>
            </div>
            
            <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', backgroundColor: activeAlertDetails.status === 'PENDING' ? '#fff3cd' : '#d4edda', color: '#0f2a31' }}>
              <strong>Status: </strong>
              {activeAlertDetails.status === 'PENDING' 
                ? 'We have found a doctor. Waiting for them to confirm...' 
                : (activeAlertDetails.status === 'COMPLETED' ? '🎉 The doctor has arrived and completed this emergency response.' : '✅ The doctor has confirmed and is heading to your location right now!')}
            </div>
            <button className="btn teal" style={{marginTop: '16px', width: '100%'}} onClick={() => navigate(`/track-ambulance?alertId=${activeAlertId}`)}>
              <span aria-hidden="true">📍</span> Open Full-Screen Live Doctor Tracking Map
            </button>
            <button className="btn plain" style={{marginTop: '10px', width: '100%', textAlign: 'center', color: '#0f2a31'}} onClick={() => {setActiveAlertId(null); setActiveAlertDetails(null); setSuccess('');}}>Dismiss / Conclude Emergency</button>
          </div>
        ) : (
          <>
            <div className="form">
              <div className="field">
                <label>What kind of emergency is it?</label>
                <select value={emergencyType} onChange={e => setEmergencyType(e.target.value)}>
                  <optgroup label="Common emergencies">
                    <option value="Cardiology">Heart / Chest Pain</option>
                    <option value="Trauma Surgery">Severe injury or accident</option>
                    <option value="Pediatrics">Child emergency</option>
                    <option value="Orthopedics">Bone or joint injury</option>
                  </optgroup>
                  <option value="Unsure / General">I'm not sure / General emergency</option>
                </select>
              </div>
              <div className="field">
                <label>Where are you?</label>
                <select value={locationType} onChange={e => setLocationType(e.target.value)}>
                  <option value="Outside">Outside / Street / Home</option>
                  <option value="Building">Inside a Hospital / Building</option>
                </select>
              </div>
              <p className="caption">Please give us exact details so the doctor can find you quickly.</p>
              {locationType === 'Building' ? (
                <>
                  <div className="field">
                    <label>Building / Hospital Name</label>
                    <input type="text" placeholder="e.g., City General Hospital" value={landmark} onChange={e => setLandmark(e.target.value)} />
                  </div>
                  <div className="split">
                    <div className="field"><label>Floor</label><input type="text" placeholder="Third floor" value={floor} onChange={e => setFloor(e.target.value)} /></div>
                    <div className="field"><label>Room</label><input type="text" placeholder="Room 312" value={room} onChange={e => setRoom(e.target.value)} /></div>
                  </div>
                </>
              ) : (
                <div className="field">
                  <label>Landmark / Address</label>
                  <input type="text" placeholder="e.g., Near Central Park entrance" value={landmark} onChange={e => setLandmark(e.target.value)} />
                </div>
              )}
            </div>
            <button className="btn red" type="button" onClick={handleEmergencySubmit} disabled={loading}>
              {loading ? 'Sending...' : 'Send for help now'} <span aria-hidden="true">→</span>
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
