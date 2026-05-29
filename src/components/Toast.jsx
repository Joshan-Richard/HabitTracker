import React, { useState, useCallback, useEffect, createContext, useContext, useRef } from 'react';
import './Toast.css';

// Toast context
const ToastContext = createContext(null);

let toastIdCounter = 0;

// Provider component
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, { id, message, type, duration }]);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

// Hook to use toast
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx.showToast;
}

// Individual Toast item
function ToastItem({ toast, onRemove }) {
    const [exiting, setExiting] = useState(false);
    const timerRef = useRef(null);

    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => onRemove(toast.id), 320);
    }, [toast.id, onRemove]);

    useEffect(() => {
        timerRef.current = setTimeout(dismiss, toast.duration);
        return () => clearTimeout(timerRef.current);
    }, [dismiss, toast.duration]);

    const icons = {
        success: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12l5 5L20 7" />
            </svg>
        ),
        error: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        ),
        warning: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        ),
        info: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        ),
    };

    return (
        <div className={`toast toast-${toast.type} ${exiting ? 'toast-exit' : 'toast-enter'}`}>
            <div className="toast-icon">{icons[toast.type] || icons.info}</div>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={dismiss}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
            <div
                className="toast-progress"
                style={{ animationDuration: `${toast.duration}ms` }}
            />
        </div>
    );
}

// Container for all toasts
function ToastContainer({ toasts, onRemove }) {
    if (toasts.length === 0) return null;
    return (
        <div className="toast-container" aria-live="polite" aria-atomic="false">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}
