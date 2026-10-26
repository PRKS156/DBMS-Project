import React, { useState } from 'react';
import { API_BASE } from '../config/api';

const COMMON_SYMPTOMS = [
  { label: '🫀 Chest Pain / Left Arm Numb', text: 'Crushing retrosternal chest pain radiating to left arm and jaw with cold sweats' },
  { label: '🩸 Severe Bleeding / Laceration', text: 'Deep arterial laceration with profuse uncontrolled bleeding and dizziness' },
  { label: '👶 Child High Fever / Convulsion', text: 'Toddler high fever 104F with involuntary shaking and lethargy' },
  { label: '🦴 Suspected Bone Fracture', text: 'Severe leg deformity and excruciating joint pain after falling down stairs' },
  { label: '🫁 Acute Respiratory Distress', text: 'Severe shortness of breath, audible wheezing, unable to speak in full sentences' }
];

export default function AISymptomTriage({ onApplyRecommendation, patientId = null, compact = false }) {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [triageResult, setTriageResult] = useState(null);
  const [error, setError] = useState('');

  const handleTriage = async (customText = null) => {
    const textToAnalyze = (customText || symptoms).trim();
    if (!textToAnalyze) {
      setError('Please describe your symptoms first.');
      return;
    }

    setLoading(true);
    setError('');
    setTriageResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/ai/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: textToAnalyze,
          patientId: patientId ? parseInt(patientId) : undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.triage) {
        setTriageResult(data.triage);
      } else {
        setError(data.message || 'Triage analysis unavailable. Proceed with manual dispatch.');
      }
    } catch (err) {
      setError('Connection to Ollama triage service timed out. You can still dispatch immediately.');
    } finally {
      setLoading(false);
    }
  };

  const applyToSOS = () => {
    if (!triageResult) return;
    if (onApplyRecommendation) {
      onApplyRecommendation({
        specialization: triageResult.recommendedSpecialization,
        urgency: triageResult.urgencyLevel,
        summary: triageResult.triageSummary,
        symptoms: symptoms
      });
    }
  };

  const getUrgencyColor = (level) => {
    switch (level) {
      case 'CRITICAL':
        return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444', badge: '🚨 CRITICAL (Code Red)' };
      case 'HIGH':
        return { bg: '#ffedd5', text: '#9a3412', border: '#f97316', badge: '⚠️ HIGH PRIORITY (Code Orange)' };
      case 'MEDIUM':
        return { bg: '#fef9c3', text: '#854d0e', border: '#eab308', badge: '🟡 MODERATE (Code Yellow)' };
      default:
        return { bg: '#e0f2fe', text: '#075985', border: '#0284c7', badge: '🟢 ROUTINE EVALUATION' };
    }
  };

  return (
    <div
      style={{
        margin: '16px 0 24px 0',
        padding: '18px 20px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(15, 118, 110, 0.06) 0%, rgba(2, 132, 199, 0.08) 100%)',
        border: '1.5px solid #0f766e',
        boxShadow: '0 4px 20px rgba(15, 118, 110, 0.08)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>✨</span>
          <div>
            <strong style={{ fontSize: '1.05rem', color: '#0f2a31' }}>Smart AI Emergency Triage</strong>
            <div style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: '600' }}>
              Powered by Local Ollama (phi3:latest) • 🔒 100% Private & HIPAA/DPDP Compliant
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.72rem',
            background: '#ccfbf1',
            color: '#115e59',
            padding: '3px 10px',
            borderRadius: '12px',
            fontWeight: '700',
            border: '1px solid #99f6e4'
          }}
        >
          ON-DEVICE LLM
        </span>
      </div>

      <p style={{ fontSize: '0.86rem', color: '#475569', margin: '0 0 12px 0' }}>
        Unsure which clinical specialist or care unit to dispatch? Describe what is happening or select a quick scenario. Ollama will assess urgency and provide immediate pre-arrival first-aid guidance.
      </p>

      {/* Quick Scenario Chips */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px' }}>
        {COMMON_SYMPTOMS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setSymptoms(item.text);
              handleTriage(item.text);
            }}
            style={{
              whiteSpace: 'nowrap',
              fontSize: '0.76rem',
              padding: '5px 10px',
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#0f766e';
              e.currentTarget.style.color = '#0f766e';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#334155';
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Textarea + Trigger */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Describe emergency symptoms (e.g. crushing chest pain, bleeding from cut, fainting)..."
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          disabled={loading}
          style={{
            flex: '1 1 280px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #94a3b8',
            fontSize: '0.9rem',
            background: '#ffffff',
            color: '#0f172a'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleTriage();
            }
          }}
        />
        <button
          type="button"
          onClick={() => handleTriage()}
          disabled={loading || !symptoms.trim()}
          style={{
            background: 'linear-gradient(135deg, #0f766e 0%, #0284c7 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: loading || !symptoms.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !symptoms.trim() ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {loading ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
              Analyzing...
            </>
          ) : (
            <>
              <span>⚡</span>
              Analyze with Ollama
            </>
          )}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#b91c1c' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Triage Output Card */}
      {triageResult && (
        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            borderRadius: '10px',
            background: '#ffffff',
            border: `1.5px solid ${getUrgencyColor(triageResult.urgencyLevel).border}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: '800',
                padding: '4px 12px',
                borderRadius: '20px',
                background: getUrgencyColor(triageResult.urgencyLevel).bg,
                color: getUrgencyColor(triageResult.urgencyLevel).text,
                border: `1px solid ${getUrgencyColor(triageResult.urgencyLevel).border}`
              }}
            >
              {getUrgencyColor(triageResult.urgencyLevel).badge}
            </span>

            <div style={{ fontSize: '0.88rem', color: '#0f172a' }}>
              Suggested Doctor: <strong>{triageResult.recommendedSpecialization}</strong>
            </div>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.45 }}>
            <strong>Triage Rationale:</strong> {triageResult.triageSummary}
          </p>

          {/* Pre-Arrival First Aid Checklist */}
          {triageResult.firstAidInstructions && triageResult.firstAidInstructions.length > 0 && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '14px'
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f766e', textTransform: 'uppercase', marginBottom: '8px' }}>
                📋 Life-Saving Pre-Arrival Actions (While responders are en route):
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.86rem', color: '#334155', lineHeight: 1.5 }}>
                {triageResult.firstAidInstructions.map((step, sIdx) => (
                  <li key={sIdx} style={{ marginBottom: '4px' }}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={applyToSOS}
              style={{
                background: '#0f766e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontWeight: '700',
                fontSize: '0.86rem',
                cursor: 'pointer'
              }}
            >
              ✅ Auto-Apply "{triageResult.recommendedSpecialization}" to SOS Dispatch
            </button>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Engine: {triageResult.model || 'Ollama Local LLM'} {triageResult.totalDurationMs ? `(${triageResult.totalDurationMs}ms)` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
