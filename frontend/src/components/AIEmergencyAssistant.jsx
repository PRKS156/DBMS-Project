import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config/api';

const QUICK_TOPICS = [
  { label: '🗺️ Website Guide', query: 'Give me a complete walkthrough of the MedRelay website and its features' },
  { label: '🚨 How to Trigger SOS', query: 'How do I trigger an emergency SOS alert on this website?' },
  { label: '🩺 Doctor On Duty', query: 'How does the Doctor On Duty shift toggle and live GPS matching work?' },
  { label: '🚑 Track Ambulance', query: 'How do I track an ambulance and responding doctor on the road map?' },
  { label: '⚙️ Admin Console', query: 'What capabilities does the Admin & Dispatcher dashboard provide?' },
  { label: '🫀 CPR Steps', query: 'Step-by-step adult CPR instructions with compression rhythm and depth' },
  { label: '🩸 Bleeding Control', query: 'How to control severe arterial and venous bleeding with direct pressure' },
  { label: '🧠 Stroke FAST', query: 'Explain the FAST protocol for recognizing an acute stroke' }
];

export default function AIEmergencyAssistant({ userRole = 'PATIENT', alertContext = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am **MedRelay AI**, powered by local on-device **Ollama** (`phi3:latest`). I can **guide you through navigating this website**, assist in triggering SOS emergencies, explain Doctor and Patient status controls, and provide immediate clinical first-aid instructions. How can I assist you right now?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState({ online: false, model: 'phi3:latest', latency: null });
  const messagesEndRef = useRef(null);

  // Poll Ollama status on open
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ai/status`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.status) {
            setAiStatus({
              online: data.status.online,
              model: data.status.activeModel || 'phi3:latest',
              latency: data.status.latencyMs || null
            });
          }
        }
      } catch (err) {
        if (isMounted) setAiStatus({ online: false, model: 'Offline / Fallback' });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText = null) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const newMessages = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.slice(-6), // Send last 6 messages for context
          role: userRole,
          context: alertContext || {}
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply, engine: data.engine }]);
      } else {
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: '⚠️ MedRelay safety protocol: Responders are dispatched. Keep the patient calm, ensure an open airway, and apply direct pressure to any bleeding. (Service note: ' + (data.message || 'AI timeout') + ')'
          }
        ]);
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: '⚠️ Emergency Alert: Call national emergency services (112 / 108) if life is in immediate danger. Responders are tracking your GPS location.'
        }

      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #0284c7 0%, #0f766e 100%)',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50px',
          padding: '12px 20px',
          fontSize: '0.92rem',
          fontWeight: '700',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.25s ease',
          backdropFilter: 'blur(8px)'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
      >
        <span style={{ fontSize: '1.2rem', animation: 'pulse 2s infinite' }}>🤖</span>
        <span>{isOpen ? 'Close AI Guide' : 'Ollama Website Guide & AI'}</span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: aiStatus.online ? '#22c55e' : '#f59e0b',
            boxShadow: aiStatus.online ? '0 0 8px #22c55e' : 'none'
          }}
          title={aiStatus.online ? 'Ollama Online' : 'Ollama Offline (Using Fallback)'}
        />
      </button>

      {/* Slide-out / Floating Chat Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '84px',
            right: '24px',
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(620px, calc(100vh - 120px))',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '16px',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: '#f8fafc',
            fontFamily: 'inherit'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🧠</span>
                <strong style={{ fontSize: '1rem', color: '#fff' }}>MedRelay AI Copilot</strong>
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: aiStatus.online ? '#14532d' : '#713f12',
                    color: aiStatus.online ? '#86efac' : '#fde047',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}
                >
                  {aiStatus.online ? `Ollama (${aiStatus.model})` : 'Offline Rules'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>
                🔒 100% Private On-Device AI • No Cloud Telemetry Leak
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.4rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px 8px'
              }}
            >
              ×
            </button>
          </div>

          {/* Quick Guidance Chips */}
          <div
            style={{
              padding: '8px 12px',
              background: '#1e293b',
              borderBottom: '1px solid #334155',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            {QUICK_TOPICS.map((topic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(topic.query)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid #475569',
                  borderRadius: '20px',
                  color: '#cbd5e1',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              >
                {topic.label}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant';
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    background: isAssistant ? '#1e293b' : '#0284c7',
                    border: isAssistant ? '1px solid #334155' : '1px solid #0369a1',
                    borderRadius: isAssistant ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                    padding: '10px 14px',
                    fontSize: '0.88rem',
                    lineHeight: '1.45',
                    color: '#ffffff'
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  {isAssistant && m.engine && (
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '6px', textAlign: 'right' }}>
                      ⚡ via {m.engine === 'ollama' ? `Ollama (${aiStatus.model})` : 'Emergency Clinical Rules'}
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px 12px 12px 2px',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>Ollama is evaluating clinical response...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '12px',
              background: '#1e293b',
              borderTop: '1px solid #334155',
              display: 'flex',
              gap: '8px'
            }}
          >
            <input
              type="text"
              placeholder="Ask how to use the website, or describe an emergency..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                background: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '0.88rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: '#0284c7',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                color: '#ffffff',
                fontWeight: '600',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.6 : 1
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
