import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './HabitTracker.css';

const INITIAL_PAST_DAYS = 30;   // how many past days to show initially
const LOAD_MORE_DAYS   = 30;    // how many more days to load each time
const FUTURE_DAYS      = 10;    // fixed number of future days

const HabitTracker = ({ tasks, completions, onAddTask, onDeleteTask, onToggleCompletion, onReorderTasks }) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskType, setNewTaskType] = useState('permanent');
    const [newTaskNotifTime, setNewTaskNotifTime] = useState('');
    const [pastDays, setPastDays] = useState(INITIAL_PAST_DAYS);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const gridContainerRef = useRef(null);
    const sentinelRef = useRef(null);

    // ─── Date generation (dynamic based on pastDays) ──────────────────────────
    const dates = useMemo(() => {
        const result = [];
        const today = new Date();
        for (let i = -pastDays; i <= FUTURE_DAYS; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            result.push({
                date,
                dateString: date.toISOString().split('T')[0],
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNum: date.getDate(),
                month: date.toLocaleDateString('en-US', { month: 'short' }),
                year: date.getFullYear(),
                isToday: i === 0,
                isPast: i < 0,
                isFuture: i > 0,
                isFirstOfMonth: date.getDate() === 1
            });
        }
        return result;
    }, [pastDays]);

    // ─── IntersectionObserver: load more past days when sentinel is visible ───
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoadingMore) {
                    setIsLoadingMore(true);

                    // Capture current scroll width & position BEFORE state update
                    const container = gridContainerRef.current;
                    const prevScrollWidth = container ? container.scrollWidth : 0;
                    const prevScrollLeft = container ? container.scrollLeft : 0;

                    setPastDays(prev => prev + LOAD_MORE_DAYS);

                    // After React re-renders, restore scroll position offset by
                    // the newly added column widths so view doesn't jump
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (container) {
                                const addedWidth = container.scrollWidth - prevScrollWidth;
                                container.scrollLeft = prevScrollLeft + addedWidth;
                            }
                            setIsLoadingMore(false);
                        });
                    });
                }
            },
            {
                root: gridContainerRef.current,
                threshold: 0.1,
                rootMargin: '0px 0px 0px 200px'
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [isLoadingMore, dates]);

    // Scroll to "today" column on first mount
    useEffect(() => {
        const container = gridContainerRef.current;
        if (!container) return;
        // Today is at index pastDays (0-based) after the task column
        // Offset: task column 180px + (pastDays * 70px) - half viewport
        const taskColWidth = 180;
        const colWidth = 70;
        const todayOffset = taskColWidth + pastDays * colWidth;
        const center = todayOffset - container.clientWidth / 2 + colWidth / 2;
        container.scrollLeft = Math.max(0, center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // only on mount

    // ─── Visible tasks ────────────────────────────────────────────────────────
    const visibleTasks = useMemo(() => {
        if (!tasks || !Array.isArray(tasks)) return [];
        try {
            const today = new Date().toISOString().split('T')[0];
            return tasks.filter(task => {
                if (!task) return false;
                if (task.type === 'permanent') return true;
                return task.createdDate === today;
            });
        } catch (err) {
            console.error('Error filtering tasks:', err);
            return [];
        }
    }, [tasks]);

    // ─── Drag end ─────────────────────────────────────────────────────────────
    const handleDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(visibleTasks);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        onReorderTasks(items);
    };

    useEffect(() => {
        if (tasks) console.log('HabitTracker mounted/updated. Tasks:', tasks.length);
    }, [tasks]);

    const handleCellClick = useCallback((e, taskId, dateString, isCompleted) => {
        if (e && e.stopPropagation) e.stopPropagation();
        onToggleCompletion(taskId, dateString, !isCompleted);
    }, [onToggleCompletion]);

    const handleAddTask = (e) => {
        e.preventDefault();
        if (!newTaskName.trim()) return;
        onAddTask({
            name: newTaskName.trim(),
            type: newTaskType,
            createdDate: new Date().toISOString().split('T')[0],
            notificationTime: newTaskNotifTime || null,
            notificationEnabled: !!newTaskNotifTime
        });
        setNewTaskName('');
        setNewTaskType('permanent');
        setNewTaskNotifTime('');
        setShowAddModal(false);
    };

    const isCompleted = (taskId, dateString) => {
        const key = `${taskId}_${dateString}`;
        return completions[key] || false;
    };

    const handleDeleteTask = (taskId, taskName) => {
        if (window.confirm(`Delete task "${taskName}"?`)) {
            onDeleteTask(taskId);
        }
    };

    return (
        <div className="habit-tracker">
            <div className="tracker-header">
                <div className="header-title">
                    <h2>Daily Habits</h2>
                    <span className="task-count">{visibleTasks.length} tasks</span>
                </div>
                <button className="btn btn-primary add-task-btn" onClick={() => setShowAddModal(true)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add Task</span>
                </button>
            </div>

            <div className="tracker-grid-container" ref={gridContainerRef}>
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="tracker-grid">
                        {/* ── Header Row ── */}
                        <div className="grid-header">
                            {/* Load-more sentinel — at the very left of the header */}
                            <div className="load-more-sentinel" ref={sentinelRef}>
                                {isLoadingMore && (
                                    <div className="load-more-spinner">
                                        <span className="spinner-dot" />
                                        <span className="spinner-dot" />
                                        <span className="spinner-dot" />
                                    </div>
                                )}
                            </div>

                            <div className="grid-cell task-header">Task</div>

                            {dates.map((dateObj, idx) => (
                                <div
                                    key={dateObj.dateString}
                                    className={`grid-cell date-header ${dateObj.isToday ? 'today' : ''} ${dateObj.isPast ? 'past' : ''} ${dateObj.isFirstOfMonth ? 'first-of-month' : ''} date-idx-${idx}`}
                                >
                                    {dateObj.isFirstOfMonth && (
                                        <span className="month-label">{dateObj.month} {dateObj.year !== new Date().getFullYear() ? dateObj.year : ''}</span>
                                    )}
                                    <span className="day-name">{dateObj.dayName}</span>
                                    <span className="day-num">{dateObj.dayNum}</span>
                                    {dateObj.isToday && <span className="today-badge">Today</span>}
                                </div>
                            ))}
                        </div>

                        {/* ── Body Rows ── */}
                        <Droppable droppableId="tasks">
                            {(provided) => (
                                <div
                                    className="grid-body"
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                >
                                    {visibleTasks.length === 0 ? (
                                        <div className="empty-state">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                                <path d="M9 12l2 2 4-4" />
                                            </svg>
                                            <p>No habits yet. Add your first habit to start tracking!</p>
                                        </div>
                                    ) : (
                                        visibleTasks.map((task, taskIdx) => (
                                            <Draggable key={task.id} draggableId={task.id} index={taskIdx}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`grid-row ${task.type} ${snapshot.isDragging ? 'dragging' : ''}`}
                                                    >
                                                        {/* Sentinel spacer cell to match load-more-sentinel width */}
                                                        <div className="load-more-sentinel sentinel-spacer" />

                                                        <div className="grid-cell task-cell">
                                                            <div className="drag-handle" {...provided.dragHandleProps}>
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <circle cx="9" cy="5" r="1" />
                                                                    <circle cx="9" cy="12" r="1" />
                                                                    <circle cx="9" cy="19" r="1" />
                                                                    <circle cx="15" cy="5" r="1" />
                                                                    <circle cx="15" cy="12" r="1" />
                                                                    <circle cx="15" cy="19" r="1" />
                                                                </svg>
                                                            </div>
                                                            <div className="task-info">
                                                                <span className={`task-type-badge ${task.type}`}>
                                                                    {task.type === 'permanent' ? '∞' : '1'}
                                                                </span>
                                                                <span className="task-name">{task.name}</span>
                                                            </div>
                                                            {task.notificationTime && (
                                                                <span className="task-notif-badge" title={`Reminder at ${task.notificationTime}`}>
                                                                    🔔
                                                                </span>
                                                            )}
                                                            <button
                                                                className="delete-btn"
                                                                onClick={() => handleDeleteTask(task.id, task.name)}
                                                                title="Delete task"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                                </svg>
                                                            </button>
                                                        </div>

                                                        {dates.map((dateObj, idx) => {
                                                            const completed = isCompleted(task.id, dateObj.dateString);
                                                            const shouldShow = task.type === 'permanent' || task.createdDate === dateObj.dateString;

                                                            return (
                                                                <div
                                                                    key={dateObj.dateString}
                                                                    className={`grid-cell checkbox-cell date-idx-${idx} ${dateObj.isToday ? 'today' : ''} ${dateObj.isPast ? 'past' : ''} ${completed ? 'completed' : ''} ${!shouldShow ? 'disabled' : ''}`}
                                                                    onClick={(e) => {
                                                                        if (shouldShow) handleCellClick(e, task.id, dateObj.dateString, completed);
                                                                    }}
                                                                >
                                                                    {shouldShow && (
                                                                        <div className={`check-mark ${completed ? 'checked' : ''}`}>
                                                                            {completed && (
                                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                                    <path d="M5 12l5 5L20 7" />
                                                                                </svg>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))
                                    )}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                </DragDropContext>
            </div>

            {/* ── Add Task Modal ── */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add New Habit</h3>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleAddTask} className="modal-body">
                            <div className="form-group">
                                <label htmlFor="taskName">Habit Name</label>
                                <input
                                    id="taskName"
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Exercise, Read, Meditate..."
                                    value={newTaskName}
                                    onChange={(e) => setNewTaskName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label>Habit Type</label>
                                <div className="type-selector">
                                    <button
                                        type="button"
                                        className={`type-option ${newTaskType === 'permanent' ? 'active' : ''}`}
                                        onClick={() => setNewTaskType('permanent')}
                                    >
                                        <span className="type-icon">∞</span>
                                        <div className="type-info">
                                            <span className="type-name">Permanent</span>
                                            <span className="type-desc">Repeats every day</span>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        className={`type-option ${newTaskType === 'daily' ? 'active' : ''}`}
                                        onClick={() => setNewTaskType('daily')}
                                    >
                                        <span className="type-icon">1</span>
                                        <div className="type-info">
                                            <span className="type-name">One-time</span>
                                            <span className="type-desc">Only for today</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Daily Reminder */}
                            <div className="form-group">
                                <label htmlFor="notifTime">
                                    Daily Reminder
                                    <span className="optional-label"> (optional)</span>
                                </label>
                                <div className="notif-time-row">
                                    <div className="notif-time-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                        </svg>
                                    </div>
                                    <input
                                        id="notifTime"
                                        type="time"
                                        className="input notif-time-input"
                                        value={newTaskNotifTime}
                                        onChange={(e) => setNewTaskNotifTime(e.target.value)}
                                    />
                                    {newTaskNotifTime && (
                                        <button
                                            type="button"
                                            className="clear-time-btn"
                                            onClick={() => setNewTaskNotifTime('')}
                                            title="Clear reminder"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                {newTaskNotifTime && (
                                    <p className="notif-time-hint">
                                        🔔 You'll get a daily reminder at {newTaskNotifTime}
                                    </p>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={!newTaskName.trim()}>
                                    Add Habit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HabitTracker;
