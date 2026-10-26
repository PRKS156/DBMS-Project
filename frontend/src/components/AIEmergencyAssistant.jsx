import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config/api';
import { getClientSideKnowledge } from '../utils/aiKnowledgeEngine';

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
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('medrelay_ai_api_key') || '');
  const [providerInput, setProviderInput] = useState(() => localStorage.getItem('medrelay_ai_provider') || 'gemini');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am **MedRelay AI**, your intelligent Emergency Medical Copilot & Website Guide. I can guide you through navigating every feature of this website, assist in triggering emergency SOS dispatches, or provide instant life-saving first-aid instructions. How can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState({ online: true, provider: 'auto', model: 'Multi-Engine', latency: null });
  const messagesEndRef = useRef(null);

  // Poll status on mount and update
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      const customKey = localStorage.getItem('medrelay_ai_api_key') || '';
      const customProv = localStorage.getItem('medrelay_ai_provider') || 'gemini';

      if (customKey) {
        if (isMounted) {
          setAiStatus({
            online: true,
            provider: customProv,
            model: customProv === 'gemini' ? 'Gemini 1.5 Flash' : (customProv === 'groq' ? 'Llama 3.3 (Groq)' : 'Custom AI'),
            latency: 120
          });
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/ai/status`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.status) {
            setAiStatus({
              online: data.status.online,
              provider: data.status.provider || 'ollama',
              model: data.status.activeModel || 'phi3:latest',
              latency: data.status.latencyMs || null
            });
          }
        } else {
          if (isMounted) setAiStatus({ online: true, provider: 'knowledge_engine', model: 'Clinical Knowledge Engine' });
        }
      } catch (err) {
        if (isMounted) setAiStatus({ online: true, provider: 'knowledge_engine', model: 'Clinical Knowledge Engine' });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [providerInput]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, showSettings]);

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('medrelay_ai_api_key', apiKeyInput.trim());
      localStorage.setItem('medrelay_ai_provider', providerInput);
    } else {
      localStorage.removeItem('medrelay_ai_api_key');
      localStorage.removeItem('medrelay_ai_provider');
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSettings(false);
    }, 1200);
  };

  const handleSend = async (queryText = null) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const newMessages = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    if (!queryText) setInput('');
    setLoading(true);

    const activeKey = localStorage.getItem('medrelay_ai_api_key') || import.meta.env?.VITE_GEMINI_API_KEY || '';
    const activeProv = localStorage.getItem('medrelay_ai_provider') || 'gemini';

    // 1. Try Backend API
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.slice(-6),
          role: userRole,
          context: alertContext || {},
          apiKey: activeKey,
          provider: activeProv
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.reply) {
          setMessages([...newMessages, { role: 'assistant', content: data.reply, engine: data.engine }]);
          setLoading(false);
          return;
        }
      }
    } catch (backendErr) {
      // Backend is offline or returning non-JSON (e.g. Render sleeping); proceed to client direct API / knowledge engine
    }

    // 2. Direct client call to Gemini if custom API key is present
    if (activeKey && activeProv === 'gemini') {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;
        const sysPrompt = "You are MedRelay AI, an emergency medical copilot and website guide. Give structured, helpful markdown answers with first-aid steps or website instructions.";
        const gRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${sysPrompt}\n\nUser Question: ${textToSend}` }] }]
          })
        });
        if (gRes.ok) {
          const gData = await gRes.json();
          const replyText = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) {
            setMessages([...newMessages, { role: 'assistant', content: replyText.trim(), engine: 'gemini_direct' }]);
            setLoading(false);
            return;
          }
        }
      } catch (gErr) {
        console.warn('Direct Gemini call failed:', gErr);
      }
    }

    // 3. High-Accuracy Client-Side Knowledge Engine (Guarantees unique, context-specific answer for every query)
    const engineReply = getClientSideKnowledge(textToSend, userRole);
    setMessages([
      ...newMessages,
      {
        role: 'assistant',
        content: engineReply,
        engine: 'knowledge_engine'
      }
    ]);
    setLoading(false);
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
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '50px',
          padding: '12px 20px',
          fontSize: '0.92rem',
          fontWeight: '700',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(2, 132, 199, 0.45)',
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
        <span>{isOpen ? 'Close AI Copilot' : 'MedRelay AI Guide'}</span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e'
          }}
          title="MedRelay AI Ready"
        />
      </button>

      {/* Slide-out / Floating Chat Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '84px',
            right: '24px',
            width: 'min(440px, calc(100vw - 32px))',
            height: 'min(640px, calc(100vh - 120px))',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '16px',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.65)',
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
              padding: '14px 18px',
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
                    fontSize: '0.7rem',
                    background: '#14532d',
                    color: '#86efac',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}
                >
                  {aiStatus.model}
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                Emergency Clinical & Website Assistant • 112 Integrated
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                title="Configure Cloud LLM API Key (Gemini, Groq, OpenAI)"
                style={{
                  background: showSettings ? '#0284c7' : 'rgba(255,255,255,0.08)',
                  border: '1px solid #475569',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                ⚙️ Key
              </button>
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
                  padding: '4px 6px'
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Settings Sub-Panel (Custom API Key Configuration) */}
          {showSettings && (
            <div
              style={{
                background: '#1e293b',
                borderBottom: '1px solid #334155',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.86rem', color: '#38bdf8' }}>🔑 Custom Cloud AI Key (Optional)</strong>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Runs Live in Cloud</span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={providerInput}
                  onChange={(e) => setProviderInput(e.target.value)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '6px 8px',
                    fontSize: '0.78rem'
                  }}
                >
                  <option value="gemini">Google Gemini (Free & Fast)</option>
                  <option value="groq">Groq (Llama 3.3 Free)</option>
                  <option value="openai">OpenAI (GPT-4o-mini)</option>
                </select>

                <input
                  type="password"
                  placeholder="Paste API Key..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '6px 10px',
                    fontSize: '0.78rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.74rem', color: '#38bdf8', textDecoration: 'none' }}
                >
                  Get free Google Gemini API Key ↗
                </a>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    style={{
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {saveSuccess ? 'Saved! ✓' : 'Save Key'}
                  </button>
                  {apiKeyInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setApiKeyInput('');
                        localStorage.removeItem('medrelay_ai_api_key');
                        setSaveSuccess(true);
                        setTimeout(() => setSaveSuccess(false), 1000);
                      }}
                      style={{
                        background: '#334155',
                        color: '#cbd5e1',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

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
                  border: '1px solid rgba(255, 255, 255, 0.12)',
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
                    maxWidth: '88%',
                    background: isAssistant ? '#1e293b' : '#0284c7',
                    border: isAssistant ? '1px solid #334155' : '1px solid #0369a1',
                    borderRadius: isAssistant ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                    padding: '11px 15px',
                    fontSize: '0.88rem',
                    lineHeight: '1.5',
                    color: '#ffffff'
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  {isAssistant && m.engine && (
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '6px', textAlign: 'right' }}>
                      ⚡ via {
                        m.engine === 'gemini' || m.engine === 'gemini_direct' ? 'Google Gemini 1.5 Flash' :
                        m.engine === 'groq' ? 'Groq Llama 3.3' :
                        m.engine === 'ollama' ? 'Local Ollama (phi3)' :
                        'MedRelay Knowledge Engine'
                      }
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
                <span>Generating clinical guidance...</span>
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
