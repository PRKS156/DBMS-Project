import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import PatientAccess from './pages/PatientAccess';
import DoctorAccess from './pages/DoctorAccess';
import AdminAccess from './pages/AdminAccess';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/patient" element={<PatientAccess />} />
          <Route path="/doctor" element={<DoctorAccess />} />
          <Route path="/admin" element={<AdminAccess />} />
          <Route path="/patient-dashboard" element={<Dashboard />} />
          <Route path="/doctor-dashboard" element={<Dashboard />} />
          <Route path="/admin-dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
