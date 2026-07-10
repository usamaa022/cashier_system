"use client";
import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') setShowBanner(false);
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'white', padding: '16px 20px',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
      zIndex: 9999,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div>
        <strong>📱 Install App</strong>
        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
          Faster access & offline mode
        </p>
      </div>
      <button onClick={handleInstall} style={{
        background: '#3498db', color: 'white',
        border: 'none', padding: '10px 24px',
        borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
      }}>
        Install
      </button>
    </div>
  );
}