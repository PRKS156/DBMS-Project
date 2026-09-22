import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };
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
            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle dark mode">
              {isDark ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
            <span className="chip quiet hide-mobile">Encrypted transmission</span>
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
