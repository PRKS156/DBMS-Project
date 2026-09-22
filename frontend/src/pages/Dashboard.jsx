import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [role, setRole] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
    setRole(localStorage.getItem('role'));
  }, [navigate]);

  return (
    <div className="card wide">
      <div className="heading">
        <span className="eyebrow">Dashboard</span>
        <h1>Welcome to MedRelay</h1>
        <p>Logged in as: {role}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div style={{ padding: '20px', background: '#f6f9f8', borderRadius: '12px', border: '1px solid #dde6e4' }}>
          <h3>Emergency Alerts</h3>
          <p>View and manage ongoing emergency alerts.</p>
          <button style={{ marginTop: '10px', padding: '8px 16px', background: '#0c605c', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>View Alerts</button>
        </div>
        
        <div style={{ padding: '20px', background: '#f6f9f8', borderRadius: '12px', border: '1px solid #dde6e4' }}>
          <h3>Dispatch Vehicles</h3>
          <p>Allocate resources to active emergencies.</p>
          <button style={{ marginTop: '10px', padding: '8px 16px', background: '#0c605c', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Manage Fleet</button>
        </div>
      </div>
    </div>
  );
}
