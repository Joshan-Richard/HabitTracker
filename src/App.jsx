import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './App.css';
import Header from './components/Header';
import HabitTracker from './components/HabitTracker';
import Calendar from './components/Calendar';
import ReportModal from './components/ReportModal';
import { ToastProvider, useToast } from './components/Toast';
import { useFirestore } from './hooks/useFirestore';
import {
    requestNotificationPermission,
    showLocalNotification,
    scheduleNotification,
    scheduleDailyNotification
} from './firebase';

// ─── Time-ago helper ──────────────────────────────────────────────────────────
function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Main App (wrapped with ToastProvider) ────────────────────────────────────
function App() {
    return (
        <ToastProvider>
            <AppInner />
        </ToastProvider>
    );
}

function AppInner() {
    const showToast = useToast();
    const [activeView, setActiveView] = useState('tracker');
    const [notificationPermission, setNotificationPermission] = useState('default');
    const [showReportModal, setShowReportModal] = useState(false);
    const [activityLog, setActivityLog] = useState([]);  // last 10 actions
    const [unreadCount, setUnreadCount] = useState(0);
    const scheduledReminders = useRef(new Set()); // track already-scheduled task+date combos

    // ─── Firestore Hooks ──────────────────────────────────────────────────────
    const {
        data: tasks,
        addDocument: addFsTask,
        deleteDocument: deleteFsTask,
        updateDocument: updateFsTask
    } = useFirestore('tasks');

    const {
        data: fsCompletions,
        setDocument: setFsCompletion,
        deleteDocument: deleteFsCompletion
    } = useFirestore('completions');

    const {
        data: events,
        addDocument: addFsEvent,
        deleteDocument: deleteFsEvent
    } = useFirestore('events');

    // Convert completions array → map
    const completions = useMemo(() => {
        if (!fsCompletions || !Array.isArray(fsCompletions)) return {};
        return fsCompletions.reduce((acc, curr) => {
            acc[curr.id] = curr.completed;
            return acc;
        }, {});
    }, [fsCompletions]);

    // ─── Notification permission ──────────────────────────────────────────────
    useEffect(() => {
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    // ─── Upcoming events for today ────────────────────────────────────────────
    const upcomingEvents = useMemo(() => {
        if (!events) return [];
        const today = new Date().toISOString().split('T')[0];
        return events.filter(e => e.date === today);
    }, [events]);

    // ─── Schedule event reminders ─────────────────────────────────────────────
    useEffect(() => {
        if (notificationPermission !== 'granted' || !events) return;
        const today = new Date().toISOString().split('T')[0];
        const todayEvents = events.filter(e => e.date === today && e.reminderEnabled);
        todayEvents.forEach(event => {
            if (!event.time) return;
            const [hours, minutes] = event.time.split(':');
            const eventTime = new Date();
            eventTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            const reminderTime = eventTime.getTime() - 10 * 60 * 1000;
            if (reminderTime > Date.now()) {
                scheduleNotification('HabitFlow Reminder', event.text, reminderTime);
            }
        });
    }, [events, notificationPermission]);

    // ─── Schedule per-task daily reminders ───────────────────────────────────
    useEffect(() => {
        if (notificationPermission !== 'granted' || !tasks) return;
        tasks.forEach(task => {
            if (!task.notificationTime || !task.notificationEnabled) return;
            const key = `${task.id}_${task.notificationTime}`;
            if (scheduledReminders.current.has(key)) return;
            scheduledReminders.current.add(key);
            scheduleDailyNotification(
                '🔔 HabitFlow Reminder',
                `Time for: ${task.name}`,
                task.notificationTime
            );
        });
    }, [tasks, notificationPermission]);

    // ─── Activity log helpers ─────────────────────────────────────────────────
    const addActivity = useCallback((message, type = 'info') => {
        const entry = { message, type, ts: Date.now(), timeAgo: 'just now' };
        setActivityLog(prev => [entry, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);
    }, []);

    // Refresh timeAgo strings every minute
    useEffect(() => {
        const id = setInterval(() => {
            setActivityLog(prev => prev.map(item => ({ ...item, timeAgo: timeAgo(item.ts) })));
        }, 60000);
        return () => clearInterval(id);
    }, []);

    // ─── Notification click handler ───────────────────────────────────────────
    const handleNotificationClick = useCallback(async () => {
        if (notificationPermission === 'default') {
            const token = await requestNotificationPermission();
            const perm = Notification.permission;
            setNotificationPermission(perm);
            if (perm === 'granted') {
                showToast('🔔 Notifications enabled!', 'success');
                showLocalNotification('HabitFlow', { body: 'You will now receive reminders.' });
                addActivity('Notifications enabled', 'info');
            } else {
                showToast('Notifications were not enabled.', 'warning');
            }
        } else if (notificationPermission === 'granted') {
            showToast('Notifications are already enabled ✓', 'info');
        } else {
            showToast('Notifications are blocked. Enable them in browser settings.', 'error');
        }
    }, [notificationPermission, showToast, addActivity]);

    // ─── Task handlers ────────────────────────────────────────────────────────
    const handleAddTask = useCallback(async (task) => {
        const maxOrder = tasks && tasks.length > 0
            ? Math.max(...tasks.map(t => t.order || 0))
            : 0;
        await addFsTask({ ...task, order: maxOrder + 1 });
        showToast(`✓ "${task.name}" added`, 'success');
        addActivity(`Added habit: ${task.name}`, 'info');
    }, [addFsTask, tasks, showToast, addActivity]);

    const handleReorderTasks = useCallback(async (reorderedTasks) => {
        for (let i = 0; i < reorderedTasks.length; i++) {
            const task = reorderedTasks[i];
            if (task.order !== i) {
                await updateFsTask(task.id, { order: i });
            }
        }
    }, [updateFsTask]);

    const handleDeleteTask = useCallback(async (taskId) => {
        const task = tasks?.find(t => t.id === taskId);
        await deleteFsTask(taskId);
        const taskCompletions = fsCompletions.filter(c => c.id.startsWith(taskId));
        for (const comp of taskCompletions) {
            await deleteFsCompletion(comp.id);
        }
        if (task) {
            showToast(`Deleted "${task.name}"`, 'warning');
            addActivity(`Deleted habit: ${task.name}`, 'info');
        }
    }, [deleteFsTask, fsCompletions, deleteFsCompletion, tasks, showToast, addActivity]);

    const handleToggleCompletion = useCallback(async (taskId, dateString, isCompleted) => {
        const key = `${taskId}_${dateString}`;
        if (isCompleted) {
            await setFsCompletion(key, { completed: true, taskId, date: dateString });
        } else {
            await deleteFsCompletion(key);
        }

        const task = tasks?.find(t => t.id === taskId);
        if (task) {
            if (isCompleted) {
                showToast(`✓ ${task.name}`, 'success');
                addActivity(`Completed: ${task.name}`, 'complete');
                if (notificationPermission === 'granted') {
                    showLocalNotification('✓ Habit Completed!', {
                        body: task.name,
                        tag: 'habit-completion'
                    });
                }
            } else {
                addActivity(`Unmarked: ${task.name}`, 'uncomplete');
            }
        }
    }, [setFsCompletion, deleteFsCompletion, tasks, notificationPermission, showToast, addActivity]);

    // ─── Event handlers ───────────────────────────────────────────────────────
    const handleAddEvent = useCallback(async (event) => {
        await addFsEvent(event);
        showToast(`📅 Event added`, 'info');
        addActivity(`Added event: ${event.text}`, 'info');
    }, [addFsEvent, showToast, addActivity]);

    const handleDeleteEvent = useCallback(async (eventId) => {
        await deleteFsEvent(eventId);
        showToast('Event removed', 'warning');
    }, [deleteFsEvent, showToast]);

    return (
        <div className="app">
            <Header
                activeView={activeView}
                onViewChange={setActiveView}
                onNotificationClick={handleNotificationClick}
                notificationPermission={notificationPermission}
                onRequestReports={() => setShowReportModal(true)}
                activityLog={activityLog}
                upcomingEvents={upcomingEvents}
                unreadCount={unreadCount}
                onClearUnread={() => setUnreadCount(0)}
            />

            <main className="main-content">
                {activeView === 'tracker' && (
                    <HabitTracker
                        tasks={tasks}
                        completions={completions}
                        onAddTask={handleAddTask}
                        onDeleteTask={handleDeleteTask}
                        onToggleCompletion={handleToggleCompletion}
                        onReorderTasks={handleReorderTasks}
                    />
                )}

                {activeView === 'calendar' && (
                    <Calendar
                        events={events}
                        onAddEvent={handleAddEvent}
                        onDeleteEvent={handleDeleteEvent}
                    />
                )}
            </main>

            {/* Install PWA Banner */}
            <InstallBanner />

            {/* Report Modal */}
            {showReportModal && (
                <ReportModal
                    tasks={tasks || []}
                    completions={completions}
                    onClose={() => setShowReportModal(false)}
                />
            )}
        </div>
    );
}

// ─── PWA Install Banner ───────────────────────────────────────────────────────
function InstallBanner() {
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
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setShowBanner(false);
        setDeferredPrompt(null);
    };

    if (!showBanner) return null;

    return (
        <div className="install-banner">
            <div className="install-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>Install HabitFlow app for the best experience!</span>
            </div>
            <div className="install-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setShowBanner(false)}>Later</button>
                <button className="btn btn-primary btn-sm" onClick={handleInstall}>Install</button>
            </div>
        </div>
    );
}

export default App;
