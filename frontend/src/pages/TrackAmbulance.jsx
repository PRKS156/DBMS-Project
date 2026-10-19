import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { API_BASE, SOCKET_URL } from '../config/api';

/* ─── Custom map icons ─── */
function createPatientIcon() {
  return L.divIcon({
    className: 'custom-marker-patient',
    html: `<div class="marker-pin patient-pin">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
      </svg>
    </div>
    <div class="marker-pulse patient-pulse"></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28]
  });
}

function createDoctorIcon() {
  return L.divIcon({
    className: 'custom-marker-doctor',
    html: `<div class="marker-pin doctor-pin" style="display:flex;align-items:center;justify-content:center;background:#0ea5e9;border:3px solid #fff;border-radius:50%;width:42px;height:42px;box-shadow:0 0 16px rgba(14,165,233,0.7);font-size:20px;cursor:pointer;">
      🩺
    </div>
    <div class="marker-pulse doctor-pulse"></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24]
  });
}

/* ─── Map auto-bounds ─── */
function FitBounds({ patientPos, doctorPos }) {
  const map = useMap();
  useEffect(() => {
    if (patientPos && doctorPos) {
      const bounds = L.latLngBounds([patientPos, doctorPos]);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
    } else if (patientPos) {
      map.setView(patientPos, 15);
    }
  }, [patientPos, doctorPos, map]);
  return null;
}

/* ─── ETA helpers ─── */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatETA(meters, isAdmitted = false) {
  if (isAdmitted || meters < 100) {
    if (meters < 30) return 'Immediate (Same ward)';
    return '~1 - 2 mins (On foot)';
  }
  const avgSpeed = 40; // km/h for urban transit
  const minutes = (meters / 1000 / avgSpeed) * 60;
  if (minutes < 1) return 'Less than 1 min';
  if (minutes < 60) return `~${Math.ceil(minutes)} min`;
  return `~${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

function formatDistance(meters, isAdmitted = false) {
  if (isAdmitted && meters < 100) return 'Within Facility Ward';
  if (meters > 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

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
  const [error, setError] = useState('');
  const [msgIndex, setMsgIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const socketRef = useRef(null);
  const startTimeRef = useRef(Date.now());

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

  // Socket.io connection with signed cryptographic token authentication (Critique #18)
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

    socketRef.current.on('doctorLocation', (loc) => {
      setDoctorLoc({ latitude: parseFloat(loc.latitude), longitude: parseFloat(loc.longitude) });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [alertId, searchParams, navigate]);

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
        (err) => {
          // Guaranteed fallback so the map NEVER stays stuck on loading
          setBrowserPos([12.97187, 79.16541]);
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    }
  }, [browserPos]);

  const patientIcon = useMemo(() => createPatientIcon(), []);
  const doctorIcon = useMemo(() => createDoctorIcon(), []);

  if (!alertId) {
    return (
      <section className="card" style={{ textAlign: 'center' }}>
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

  // Real Doctor GPS location - strictly from live doctorLoc (socket) or alertDetails (database)
  const doctorPos = (doctorLoc?.latitude && doctorLoc?.longitude)
    ? [parseFloat(doctorLoc.latitude), parseFloat(doctorLoc.longitude)]
    : (alertDetails?.doctorLat && alertDetails?.doctorLng
        ? [parseFloat(alertDetails.doctorLat), parseFloat(alertDetails.doctorLng)]
        : null);

  const isAdmitted = Boolean(
    (alertDetails?.description?.includes('Floor:') || alertDetails?.description?.includes('Floor ') || alertDetails?.description?.includes('Building')) &&
    !alertDetails?.description?.includes('Outdoor SOS')
  );

  const distance = patientPos && doctorPos
    ? getDistance(patientPos[0], patientPos[1], doctorPos[0], doctorPos[1])
    : null;

  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  return (
    <div className="track-page">
      {/* Indoor Ward Notification */}
      {isAdmitted && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid #14b8a6',
          borderRadius: '30px',
          padding: '8px 20px',
          color: '#5eead4',
          fontSize: '0.85rem',
          fontWeight: '600',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: '90%',
          textAlign: 'center'
        }}>
          <span>🏥</span>
          <span>
            {alertDetails?.hospitalName ? `${alertDetails.hospitalName} Ward Dispatch: ` : 'Indoor Ward Dispatch: '}
            Patient is admitted inside facility. Responding on foot.
          </span>
        </div>
      )}

      {/* ─── Map ─── */}
      <div className="track-map-container">
        <MapContainer
          center={patientPos}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <FitBounds patientPos={patientPos} doctorPos={doctorPos} />

          {/* Patient marker */}
          <Marker position={patientPos} icon={patientIcon}>
            <Popup className="custom-popup">
              <strong>📍 Your Location</strong>
              <br />
              <span style={{ fontSize: '11px', color: '#6b8891' }}>
                {patientPos[0].toFixed(5)}, {patientPos[1].toFixed(5)}
              </span>
            </Popup>
          </Marker>

          {/* Doctor marker */}
          {doctorPos && (
            <Marker position={doctorPos} icon={doctorIcon}>
              <Popup className="custom-popup">
                <strong>🩺 Dr. {alertDetails?.doctorname || 'Physician'}</strong>
                <br />
                <span style={{ fontSize: '11px', color: '#6b8891' }}>
                  {distance ? `${formatDistance(distance, isAdmitted)} away` : 'Live GPS active'}
                </span>
              </Popup>
            </Marker>
          )}

          {/* Route polyline */}
          {patientPos && doctorPos && (
            <Polyline
              positions={[doctorPos, patientPos]}
              pathOptions={{
                color: '#5ce0d5',
                weight: 4,
                opacity: 0.8,
                dashArray: '12 8',
                lineCap: 'round'
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* ─── Bottom overlay panel ─── */}
      <div className="track-overlay">
        {/* Status indicator */}
        <div className="track-status-bar">
          <div className={`track-status-dot ${alertDetails?.status === 'TRANSPORTING' ? 'transporting' : (alertDetails?.status === 'DISPATCHED' ? 'confirmed' : 'pending')}`}></div>
          <span className="track-status-text">
            {alertDetails?.status === 'TRANSPORTING'
              ? `🚑 Patient secured — En route to ${alertDetails?.hospitalName || 'hospital'} with medical team`
              : (alertDetails?.status === 'DISPATCHED'
                  ? (isAdmitted
                      ? 'Doctor confirmed — heading directly to your ward on foot'
                      : (doctorPos ? 'Doctor confirmed — heading to you now' : 'Doctor confirmed — acquiring doctor GPS...'))
                  : 'Finding nearest doctor...')}
          </span>
        </div>

        {/* Doctor info card */}
        {alertDetails && (
          <div className="track-doctor-card">
            <div className="track-doctor-avatar">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="track-doctor-info">
              <h3>Dr. {alertDetails.doctorname}</h3>
              <span>{alertDetails.specialization}</span>
              {alertDetails.isFallback && (
                <div style={{ marginTop: '4px', padding: '3px 8px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: '600' }}>
                  ⚠️ Specialist Fallback: Closest Emergency Physician
                </div>
              )}
              {alertDetails.hospitalName && (
                <span style={{ display: 'block', fontSize: '12px', color: '#5eead4', marginTop: '3px', fontWeight: '500' }}>
                  🏥 {alertDetails.hospitalName}
                </span>
              )}
              {alertDetails.vehiclePlate && (
                <span style={{ display: 'block', fontSize: '12px', color: '#38bdf8', marginTop: '3px', fontWeight: '500' }}>
                  🚑 Ambulance: {alertDetails.vehiclePlate} ({alertDetails.vehicleType || 'Emergency Unit'})
                </span>
              )}
            </div>
            <a href={`tel:${alertDetails.doctorphone}`} className="track-call-btn" title="Call doctor">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </a>
          </div>
        )}

        {/* Live metrics */}
        <div className="track-metrics">
          <div className="track-metric">
            <span className="track-metric-label">Distance</span>
            <strong className="track-metric-value">
              {distance !== null ? formatDistance(distance, isAdmitted) : 'Locating...'}
            </strong>
          </div>
          <div className="track-metric">
            <span className="track-metric-label">Est. Arrival</span>
            <strong className="track-metric-value accent">
              {distance !== null ? formatETA(distance, isAdmitted) : 'Locating...'}
            </strong>
          </div>
          <div className="track-metric">
            <span className="track-metric-label">Elapsed</span>
            <strong className="track-metric-value">{elapsedMin}:{String(elapsedSec).padStart(2, '0')}</strong>
          </div>
        </div>

        {/* Reassurance */}
        <div className="track-reassurance" key={msgIndex}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>{REASSURANCE_MESSAGES[msgIndex]}</span>
        </div>

        {/* Actions */}
        <div className="track-actions" style={{ display: 'flex', gap: '10px' }}>
          <button className="btn navy track-back-btn" style={{ flex: 1 }} onClick={() => navigate('/patient-dashboard')}>
            ← Back to Dashboard
          </button>
          <button
            className="btn"
            style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
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
            ❌ Cancel SOS
          </button>
        </div>
      </div>
    </div>
  );
}
