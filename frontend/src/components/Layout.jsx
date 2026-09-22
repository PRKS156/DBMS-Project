import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="emblem" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round">
                <path d="M12 4v16M4 12h16" />
                <path d="M5 5l14 14M19 5L5 19" opacity=".32" />
              </svg>
            </span>
            <span>
              <span className="brand-name">MedRelay</span>
              <span className="brand-sub">Emergency Medical Dispatch</span>
            </span>
          </Link>
          <div className="topbar-meta">
            <span className="chip quiet">Encrypted transmission</span>
            <span className="chip">
              <span className="dot"></span>Dispatch network operational
            </span>
          </div>
        </div>
      </header>
      <div className="emergency-strip">
        <p className="emergency-note">
          <strong>Important:</strong>&nbsp;In the event of a life-threatening emergency, contact your national emergency number immediately. MedRelay supplements, and does not replace, emergency services.
        </p>
      </div>

      <main className="shell">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>
          <strong>MedRelay Emergency Medical Dispatch.</strong> Location data is collected only while a session is active and is used exclusively for clinical dispatch. Records are retained in accordance with applicable data-protection obligations.
        </p>
      </footer>
    </>
  );
}
