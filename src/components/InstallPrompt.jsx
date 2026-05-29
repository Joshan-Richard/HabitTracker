import React, { useState, useEffect } from 'react';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        // Check if standalone
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone ||
            document.referrer.includes('android-app://');

        setIsStandalone(isStandaloneMode);
        if (isStandaloneMode) return;

        // Check platform
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(isIOSDevice);

        const handler = (e) => {
            console.log('beforeinstallprompt fired');
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallButton(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        console.log('Added beforeinstallprompt listener');

        // Always show button if not in standalone mode
        // If beforeinstallprompt fires later, we'll use it.
        // If not (iOS or already ignored), we'll show manual instructions.
        setShowInstallButton(true);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response: ${outcome}`);
            setDeferredPrompt(null);
            setShowInstallButton(false);
        } else {
            // Show instructions for iOS or manual install
            setShowInstructions(!showInstructions);
        }
    };

    if (!showInstallButton && !showInstructions) return null;
    if (isStandalone) return null;

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={handleInstallClick}
                className="btn-primary"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    fontSize: '0.9rem',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Install
            </button>

            {showInstructions && (
                <div style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '280px',
                    backgroundColor: '#1a2634',
                    border: '1px solid #2a3b4c',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    color: '#e2e8f0'
                }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Install App</h4>
                    {isIOS ? (
                        <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: '1.4' }}>
                            Tap the share button <span style={{ padding: '2px 6px', background: '#334', borderRadius: '4px' }}>⎋</span> below and select <strong>"Add to Home Screen"</strong>
                            <span style={{ display: 'inline-block', marginLeft: '4px', padding: '2px 6px', background: '#334', borderRadius: '4px' }}>+</span>
                        </p>
                    ) : (
                        <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: '1.4' }}>
                            Tap option menu button <span style={{ padding: '2px 6px', background: '#334', borderRadius: '4px' }}>⋮</span> and select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.
                        </p>
                    )}
                    <button
                        onClick={() => setShowInstructions(false)}
                        style={{
                            marginTop: '12px',
                            background: 'transparent',
                            border: '1px solid #4a5568',
                            color: '#cbd5e0',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            width: '100%',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};

export default InstallPrompt;
