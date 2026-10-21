import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE, SOCKET_URL } from '../config/api';
import { fetchRoadRoute, formatRoadDistance, formatRoadETA, getHaversineDistance } from '../utils/routeService';

/* ─── Reassurance messages ─── */
const REASSURANCE_MESSAGES = [
  "Stay calm. Help is on the way to your location.",
  "A medical professional is heading towards you right now.",
  "You're not alone. Assistance will arrive shortly.",
  "Try to stay still and keep breathing slowly.",
  "The doctor can see your location and is moving towards you."
];

export default function TrackAmbulance() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alertId = searchParams.get('alertId');
  const [alertDetails, setAlertDetails] = useState(null);
  const [doctorLoc, setDoctorLoc] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [error, setError] = useState('');
  const [msgIndex, setMsgIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [signalLost, setSignalLost] = useState(false);
  const [signalLostMsg, setSignalLostMsg] = useState('');
  const socketRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Scrub cryptographic token from URL address bar on mount
  useEffect(() => {
    const rawToken = searchParams.get('token');
    if (rawToken) {
      localStorage.setItem('activeTrackingToken', rawToken);
      const cleanParams = new URLSearchParams(searchParams);
      cleanParams.delete('token');
      const newQuery = cleanParams.toString() ? `?${cleanParams.toString()}` : '';
      window.history.replaceState({}, document.title, window.location.pathname + newQuery + window.location.hash);
    }
  }, []);

  // Rotate reassurance messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % REASSURANCE_MESSAGES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Socket.io connection with signed cryptographic token authentication
  useEffect(() => {
    if (!alertId) return;

    const authToken = searchParams.get('token') || localStorage.getItem('activeTrackingToken') || localStorage.getItem('token');
    socketRef.current = io(SOCKET_URL, {
      auth: { token: authToken }
    });

    socketRef.current.emit('joinAlertRoom', { alertId, token: authToken });

    socketRef.current.on('joinError', (err) => {
      console.warn('Socket security rejection:', err);
      setError(err.message || 'Access denied: Valid authorization required to track this emergency.');
    });

    socketRef.current.on('alertUpdate', (data) => {
      if (data.status === 'DISPATCHED') {
        setAlertDetails((prev) => (prev ? { ...prev, status: 'DISPATCHED' } : prev));
      } else if (data.status === 'TRANSPORTING') {
        setAlertDetails((prev) => (prev ? { ...prev, status: 'TRANSPORTING' } : prev));
      } else if (data.status === 'COMPLETED') {
        setAlertDetails((prev) => (prev ? { ...prev, status: 'COMPLETED' } : prev));
      } else if (data.status === 'CANCELLED') {
        alert('This emergency was cancelled: ' + (data.reason || 'Cancelled'));
        navigate('/patient-dashboard');
      }
    });

    socketRef.current.on('doctorSignalLost', (data) => {
      setSignalLost(true);
      setSignalLostMsg(data?.message || 'Telemetric signal temporarily lost from responder. Device reconnecting... Active dispatch is retained.');
    });

    socketRef.current.on('doctorSignalRestored', () => {
      setSignalLost(false);
      setSignalLostMsg('');
    });

    socketRef.current.on('doctorLocation', (loc) => {
      setDoctorLoc({ latitude: parseFloat(loc.latitude), longitude: parseFloat(loc.longitude) });
      setSignalLost(false);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [alertId, navigate]);

  // Poll alert status
  useEffect(() => {
    if (!alertId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/alerts/${alertId}/status`);
        const data = await res.json();
        if (res.ok && data.success) {
          setAlertDetails(data.alert);
          if (data.alert.doctorLat && data.alert.doctorLng) {
            setDoctorLoc({ latitude: data.alert.doctorLat, longitude: data.alert.doctorLng });
          }
          if (data.alert.doctorId && socketRef.current) {
            socketRef.current.on(`doctorLocation_${data.alert.doctorId}`, (loc) => {
              setDoctorLoc({ latitude: parseFloat(loc.latitude), longitude: parseFloat(loc.longitude) });
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [alertId]);

  // Resilient GPS location resolving
  const [browserPos, setBrowserPos] = useState(() => {
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    if (latParam && lngParam && !isNaN(parseFloat(latParam))) {
      return [parseFloat(latParam), parseFloat(lngParam)];
    }
    const savedLat = localStorage.getItem('userLat');
    const savedLng = localStorage.getItem('userLng');
    if (savedLat && savedLng && !isNaN(parseFloat(savedLat))) {
      return [parseFloat(savedLat), parseFloat(savedLng)];
    }
    return null;
  });

  useEffect(() => {
    if (!browserPos && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setBrowserPos([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          setBrowserPos([12.97187, 79.16541]);
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    }
  }, [browserPos]);

  if (!alertId) {
    return (
      <section className="card" style={{ textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <div className="heading">
          <span className="eyebrow">Tracking</span>
          <h1>No active emergency.</h1>
          <p className="sub">You need an active emergency alert to track the assigned doctor.</p>
        </div>
        <button className="btn teal" onClick={() => navigate('/patient-dashboard')}>
          Go to Dashboard <span aria-hidden="true">→</span>
        </button>
      </section>
    );
  }

  const patientPos = (alertDetails?.latitude && alertDetails?.longitude)
    ? [parseFloat(alertDetails.latitude), parseFloat(alertDetails.longitude)]
    : (browserPos || [12.97187, 79.16541]);

  const doctorPos = (doctorLoc?.latitude && doctorLoc?.longitude)
    ? [parseFloat(doctorLoc.latitude), parseFloat(doctorLoc.longitude)]
    : (alertDetails?.doctorLat && alertDetails?.doctorLng
        ? [parseFloat(alertDetails.doctorLat), parseFloat(alertDetails.doctorLng)]
        : null);

  const isAdmitted = Boolean(
    (alertDetails?.description?.includes('Floor:') || alertDetails?.description?.includes('Floor ') || alertDetails?.description?.includes('Building')) &&
    !alertDetails?.description?.includes('Outdoor SOS')
  );

  // Calculate live road route
  useEffect(() => {
    if (!patientPos || !doctorPos) return;
    let isCancelled = false;

    const loadRoute = async () => {
      try {
        const route = await fetchRoadRoute({
          doctorPos,
          patientPos,
          alertId,
          isAdmitted
        });
        if (!isCancelled && route) {
          setRouteData(route);
        }
      } catch (err) {
        console.warn('Road routing error:', err);
      }
    };

    loadRoute();
    const interval = setInterval(loadRoute, 8000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [patientPos?.[0], patientPos?.[1], doctorPos?.[0], doctorPos?.[1], alertId, isAdmitted]);

  const effectiveDoctorPos = (routeData?.adjustedPos && !doctorLoc)
    ? routeData.adjustedPos
    : doctorPos;

  const rawMeters = routeData?.distanceMeters ?? (patientPos && effectiveDoctorPos
    ? getHaversineDistance(patientPos[0], patientPos[1], effectiveDoctorPos[0], effectiveDoctorPos[1])
    : null);

  const liveDistanceFormatted = routeData?.distanceFormatted || (rawMeters !== null ? formatRoadDistance(rawMeters, isAdmitted) : 'Locating...');
  const liveEtaFormatted = routeData?.etaFormatted || (rawMeters !== null ? formatRoadETA(Math.round(rawMeters / 11), rawMeters, isAdmitted) : 'Calculating...');

  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  return (
    <div style={{ minHeight: '100vh', background: '#0a1214', color: '#f8fafc', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Container constraint */}
      <div style={{ maxWidth: '820px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Top Header Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 18px' }}>
          <button
            type="button"
            className="btn-sm"
            style={{ background: 'transparent', color: '#5eead4', border: '1px solid #14b8a6', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => navigate('/patient-dashboard')}
          >
            ← Back to Dashboard
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }}></span>
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '600' }}>
              Live Telemetry Active • SOS #{alertId}
            </span>
          </div>

          <a
            href="tel:911"
            style={{ textDecoration: 'none', background: '#dc2626', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            🚨 Call 911
          </a>
        </div>

        {/* Indoor Ward Notification */}
        {isAdmitted && (
          <div style={{ background: '#042f2e', border: '1px solid #14b8a6', borderRadius: '12px', padding: '14px 18px', color: '#ccfbf1', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🏥</span>
            <div>
              <strong style={{ color: '#5eead4', fontSize: '0.95rem' }}>IN-HOSPITAL WARD DISPATCH</strong>
              <div style={{ fontSize: '0.85rem', color: '#99f6e4', marginTop: '2px' }}>
                {alertDetails?.hospitalName ? `${alertDetails.hospitalName}: ` : ''}Physician is responding on foot within your facility.
              </div>
            </div>
          </div>
        )}

        {/* Responder Signal Lost Warning */}
        {signalLost && (
          <div style={{ background: '#78350f', border: '1px solid #d97706', borderRadius: '12px', padding: '14px 18px', color: '#fef3c7', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <strong style={{ color: '#fbbf24', fontSize: '0.95rem' }}>SIGNAL RECONNECTING</strong>
              <div style={{ fontSize: '0.85rem', color: '#fef3c7', marginTop: '2px' }}>
                {signalLostMsg || 'Telemetric signal temporarily lost from responder. Device reconnecting... Active dispatch is retained.'}
              </div>
            </div>
          </div>
        )}

        {/* Hero Live Distance Card */}
        <div style={{
          background: 'linear-gradient(145deg, #0f1f24, #12282d)',
          border: '1px solid rgba(92, 224, 213, 0.3)',
          borderRadius: '16px',
          padding: '28px 24px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: '#5eead4', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
              Real-Time Emergency Road Telemetry
            </span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(94, 234, 212, 0.1)', border: '1px solid rgba(94, 234, 212, 0.3)', color: '#5eead4', padding: '4px 10px', borderRadius: '20px' }}>
              ⏱️ Elapsed: {elapsedMin}:{String(elapsedSec).padStart(2, '0')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', alignItems: 'center' }}>
            {/* Live Distance Figure */}
            <div>
              <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '4px' }}>Live Distance to Patient</div>
              <div style={{ fontSize: '3.2rem', fontWeight: '900', color: '#38bdf8', lineHeight: 1, letterSpacing: '-0.02em' }}>
                {liveDistanceFormatted}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
                🛣️ Calculated via Live Road Network
              </div>
            </div>

            {/* Estimated Arrival Time Figure */}
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '18px 22px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Estimated Arrival (ETA)</div>
              <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#34d399', lineHeight: 1.1 }}>
                {liveEtaFormatted}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#a7f3d0', marginTop: '6px' }}>
                {isAdmitted ? 'Direct on-foot transit' : 'Priority emergency road navigation'}
              </div>
            </div>
          </div>

          {/* Visual Distance Proximity Bar */}
          <div style={{ marginTop: '28px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '8px' }}>
              <span>📍 Your Location</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>🩺 Clinician Responding ({liveDistanceFormatted})</span>
              <span>🏥 Receiving Facility</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: '65%',
                background: 'linear-gradient(90deg, #22c55e, #38bdf8)',
                borderRadius: '4px'
              }}></div>
            </div>
          </div>
        </div>

        {/* Assigned Medical Team & Vehicle Card */}
        {alertDetails && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px', fontWeight: 'bold' }}>
              Assigned Emergency Care Unit
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #0f766e, #0ea5e9)', display: 'grid', placeItems: 'center', fontSize: '26px' }}>
                  🩺
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Dr. {alertDetails.doctorname}</h3>
                  <div style={{ fontSize: '0.9rem', color: '#38bdf8', marginTop: '2px' }}>{alertDetails.specialization}</div>
                  {alertDetails.hospitalName && (
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>🏥 {alertDetails.hospitalName}</div>
                  )}
                  {alertDetails.vehiclePlate && (
                    <div style={{ fontSize: '0.82rem', color: '#38bdf8', marginTop: '2px', fontWeight: '600' }}>
                      🚑 Ambulance: {alertDetails.vehiclePlate} ({alertDetails.vehicleType || 'EMS Emergency Unit'})
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {alertDetails.doctorphone && (
                  <a
                    href={`tel:${alertDetails.doctorphone}`}
                    style={{
                      background: '#0f766e',
                      color: '#fff',
                      textDecoration: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    📞 Call Doctor
                  </a>
                )}
              </div>
            </div>

            {/* Specialist Fallback Notice if triggered */}
            {alertDetails.isFallback && (
              <div style={{ marginTop: '16px', padding: '10px 14px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', fontSize: '0.85rem' }}>
                <strong>⚠️ Specialist Fallback Notice:</strong> Closest emergency physician dispatched immediately for initial stabilization while specialist is on standby.
              </div>
            )}
          </div>
        )}

        {/* GPS Coordinates & Direct Navigation */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Patient Location (GPS)</div>
            <div style={{ fontSize: '0.95rem', color: '#f1f5f9', fontWeight: 'bold' }}>
              {patientPos ? `${patientPos[0].toFixed(5)}, ${patientPos[1].toFixed(5)}` : 'Resolving GPS...'}
            </div>
            {effectiveDoctorPos && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Doctor GPS: {effectiveDoctorPos[0].toFixed(5)}, {effectiveDoctorPos[1].toFixed(5)}
              </div>
            )}
          </div>

          {patientPos && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${patientPos[0]},${patientPos[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🧭 Open Google Maps Navigation ↗
            </a>
          )}
        </div>

        {/* Reassurance Message Card */}
        <div style={{ background: 'rgba(92, 224, 213, 0.06)', border: '1px solid rgba(92, 224, 213, 0.2)', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>💚</span>
          <span style={{ fontSize: '0.92rem', color: '#ccfbf1', fontWeight: '500' }}>
            {REASSURANCE_MESSAGES[msgIndex]}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          <button
            type="button"
            className="btn"
            style={{ flex: 1, padding: '14px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => navigate('/patient-dashboard')}
          >
            ← Back to Dashboard
          </button>
          <button
            type="button"
            className="btn"
            style={{ flex: 1, padding: '14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={async () => {
              if (window.confirm("Are you sure you want to cancel this emergency request? Dispatched medical personnel and vehicle will be immediately released back to duty.")) {
                try {
                  await fetch(`${API_BASE}/api/alerts/${alertId}/cancel`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'Cancelled by patient from live tracking screen' })
                  });
                  alert('Emergency cancelled.');
                  navigate('/patient-dashboard');
                } catch(e) {
                  console.error(e);
                  navigate('/patient-dashboard');
                }
              }
            }}
          >
            ❌ Cancel Emergency SOS
          </button>
        </div>

      </div>
    </div>
  );
}
