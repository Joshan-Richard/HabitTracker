import React, { useState, useEffect, useRef } from 'react';
import InstallPrompt from './InstallPrompt';
import './Header.css';

const Header = ({
    activeView,
    onViewChange,
    onNotificationClick,
    notificationPermission = 'default',
    onRequestReports,
    activityLog = [],
    upcomingEvents = [],
    unreadCount = 0,
    onClearUnread
}) => {
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const panelRef = useRef(null);
    const bellRef = useRef(null);

    // Close panel when clicking outside
    useEffect(() => {
        if (!showNotifPanel) return;
        const handleClick = (e) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target) &&
                bellRef.current && !bellRef.current.contains(e.target)
            ) {
                setShowNotifPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showNotifPanel]);

    const handleBellClick = () => {
        setShowNotifPanel(prev => !prev);
        if (!showNotifPanel && onClearUnread) onClearUnread();
    };

    const permissionColor = {
        granted: 'var(--accent-success)',
        denied: 'var(--accent-error)',
        default: 'var(--accent-warning)'
    }[notificationPermission] || 'var(--accent-warning)';

    const permissionLabel = {
        granted: 'Enabled',
        denied: 'Blocked',
        default: 'Not enabled'
    }[notificationPermission] || 'Not enabled';

    const now = new Date();

    return (
        <header className="header">
            <div className="header-content">
                <div className="header-brand">
                    <div className="logo">
                        <img src="/icons/icon-192.png" alt="HabitFlow Logo" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
                    </div>
                    <h1 className="app-title">HabitFlow</h1>
                </div>

                <nav className="header-nav">
                    <button
                        className={`nav-btn ${activeView === 'tracker' ? 'active' : ''}`}
                        onClick={() => onViewChange('tracker')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                            <line x1="9" y1="4" x2="9" y2="10" />
                        </svg>
                        <span>Tracker</span>
                    </button>

                    <button
                        className={`nav-btn ${activeView === 'calendar' ? 'active' : ''}`}
                        onClick={() => onViewChange('calendar')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>Calendar</span>
                    </button>
                </nav>

                <div className="header-actions">
                    <InstallPrompt />

                    {/* Reports Button */}
                    <button
                        className="action-btn reports-btn"
                        onClick={onRequestReports}
                        title="Download Report"
                        id="reports-btn"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </button>

                    {/* Notification Bell */}
                    <div className="notif-bell-wrapper">
                        <button
                            ref={bellRef}
                            className={`action-btn notif-btn ${showNotifPanel ? 'active' : ''}`}
                            onClick={handleBellClick}
                            title="Notifications"
                            id="notification-btn"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="notif-badge">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Notification Panel */}
                        {showNotifPanel && (
                            <div ref={panelRef} className="notif-panel animate-fadeIn">
                                <div className="notif-panel-header">
                                    <span className="notif-panel-title">Notifications</span>
                                    <div
                                        className="notif-permission-status"
                                        style={{ '--perm-color': permissionColor }}
                                    >
                                        <span className="perm-dot" />
                                        {permissionLabel}
                                    </div>
                                </div>

                                {/* Enable CTA */}
                                {notificationPermission !== 'granted' && (
                                    <button
                                        className="notif-enable-btn"
                                        onClick={() => {
                                            onNotificationClick();
                                            setShowNotifPanel(false);
                                        }}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                        </svg>
                                        {notificationPermission === 'denied'
                                            ? 'Notifications blocked in browser settings'
                                            : 'Enable push notifications'}
                                    </button>
                                )}

                                {/* Upcoming Events */}
                                {upcomingEvents.length > 0 && (
                                    <div className="notif-section">
                                        <div className="notif-section-label">Upcoming Today</div>
                                        {upcomingEvents.map((ev, i) => (
                                            <div key={i} className="notif-item notif-event">
                                                <div className="notif-item-icon">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" />
                                                        <line x1="16" y1="2" x2="16" y2="6" />
                                                        <line x1="8" y1="2" x2="8" y2="6" />
                                                        <line x1="3" y1="10" x2="21" y2="10" />
                                                    </svg>
                                                </div>
                                                <div className="notif-item-content">
                                                    <span className="notif-item-title">{ev.text}</span>
                                                    {ev.time && <span className="notif-item-time">{ev.time}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Activity Log */}
                                <div className="notif-section">
                                    <div className="notif-section-label">Recent Activity</div>
                                    {activityLog.length === 0 ? (
                                        <div className="notif-empty">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                            </svg>
                                            <span>No recent activity</span>
                                        </div>
                                    ) : (
                                        activityLog.slice(0, 8).map((item, i) => (
                                            <div key={i} className={`notif-item notif-activity notif-${item.type}`}>
                                                <div className="notif-item-icon">
                                                    {item.type === 'complete' ? (
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <path d="M5 12l5 5L20 7" />
                                                        </svg>
                                                    ) : item.type === 'uncomplete' ? (
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <line x1="18" y1="6" x2="6" y2="18" />
                                                            <line x1="6" y1="6" x2="18" y2="18" />
                                                        </svg>
                                                    ) : (
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="12" y1="8" x2="12" y2="12" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="notif-item-content">
                                                    <span className="notif-item-title">{item.message}</span>
                                                    <span className="notif-item-time">{item.timeAgo}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
