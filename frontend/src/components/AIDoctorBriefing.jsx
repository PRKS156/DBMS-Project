import React, { useState } from 'react';
import { API_BASE } from '../config/api';

export default function AIDoctorBriefing({ alertId, patientName = 'Patient' }) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchBriefing = async () => {
    if (briefing) {
      setIsExpanded(!isExpanded);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/ai/briefing/${alertId}`);
      const data = await res.json();
      if (res.ok && data.success && data.briefing) {
        setBriefing(data.briefing);
        setIsExpanded(true);
      } else {
        setError(data.message || 'Unable to generate clinical briefing.');
      }
    } catch (err) {
      setError('Connection to Ollama briefing service timed out.');
    } finally {
      setLoading(false);
    }
  };

  const copyHandoverNote = () => {
    if (briefing?.handoverNote) {
      navigator.clipboard.writeText(briefing.handoverNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        margin: '12px 0',
        borderRadius: '10px',
        border: '1px solid #38bdf8',
        background: '#082f49',
        color: '#f0f9ff',
        overflow: 'hidden'
      }}
    >
      {/* Header / Trigger */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🤖</span>
          <div>
            <strong style={{ fontSize: '0.95rem', color: '#e0f2fe' }}>AI Pre-Arrival Clinical Handover</strong>
            <div style={{ fontSize: '0.74rem', color: '#7dd3fc' }}>
              Synthesized by Ollama (phi3:latest) • Evaluates drug allergies & stabilization protocols
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchBriefing}
          disabled={loading}
          style={{
            background: isExpanded ? 'rgba(255,255,255,0.1)' : '#0284c7',
            color: '#ffffff',
            border: '1px solid #38bdf8',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '0.82rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {loading ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Generating...
            </>
          ) : isExpanded ? (
            '▲ Hide Briefing'
          ) : (
            '⚡ View Clinical Briefing'
          )}
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', color: '#fca5a5', fontSize: '0.82rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Expanded Briefing Content */}
      {isExpanded && briefing && (
        <div style={{ padding: '16px', borderTop: '1px solid rgba(56, 189, 248, 0.2)', background: '#0b192c' }}>
          {/* Headline */}
          <div style={{ marginBottom: '12px', fontSize: '0.94rem', color: '#f8fafc', lineHeight: 1.4 }}>
            <strong>Clinical Presentation:</strong> {briefing.clinicalHeadline}
          </div>

          {/* Critical Contraindications Alert Box */}
          {briefing.criticalContraindications && briefing.criticalContraindications.length > 0 && (
            <div
              style={{
                marginBottom: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#7f1d1d',
                border: '1.5px solid #ef4444',
                color: '#fee2e2'
              }}
            >
              <div style={{ fontWeight: '800', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span>⚠️</span> CRITICAL CLINICAL CONTRAINDICATIONS & ALLERGIES:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.86rem', lineHeight: 1.45 }}>
                {briefing.criticalContraindications.map((item, idx) => (
                  <li key={idx} style={{ fontWeight: '600' }}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Assessment Steps */}
          {briefing.immediateAssessmentSteps && briefing.immediateAssessmentSteps.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
                Primary Scene Assessment Priorities:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {briefing.immediateAssessmentSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Medications */}
          {briefing.recommendedMedications && briefing.recommendedMedications.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#4ade80', textTransform: 'uppercase', marginBottom: '6px' }}>
                Initial Stabilization Considerations:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {briefing.recommendedMedications.map((med, idx) => (
                  <li key={idx}>{med}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Handover Note */}
          {briefing.handoverNote && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #334155'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Emergency Handover Note (ED Reception)
                </span>
                <button
                  type="button"
                  onClick={copyHandoverNote}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Note'}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.45, fontStyle: 'italic' }}>
                "{briefing.handoverNote}"
              </p>
            </div>
          )}

          <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#64748b', textAlign: 'right' }}>
            🔒 Evaluated via local Ollama engine ({briefing.model || 'phi3:latest'}) • Zero PHI cloud leakage
          </div>
        </div>
      )}
    </div>
  );
}
