import React, { useState, useMemo } from 'react';
import './Calendar.css';

const Calendar = ({ events, onAddEvent, onDeleteEvent }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [newEventText, setNewEventText] = useState('');
    const [newEventTime, setNewEventTime] = useState('09:00');
    const [enableReminder, setEnableReminder] = useState(false);

    // Get calendar days for current month
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();
        const totalDays = lastDay.getDate();

        const days = [];

        // Add padding for days before month starts
        for (let i = 0; i < startPadding; i++) {
            const prevDate = new Date(year, month, -startPadding + i + 1);
            days.push({ date: prevDate, isCurrentMonth: false, dateString: prevDate.toISOString().split('T')[0] });
        }

        // Add days of current month
        for (let i = 1; i <= totalDays; i++) {
            const date = new Date(year, month, i);
            days.push({ date, isCurrentMonth: true, dateString: date.toISOString().split('T')[0] });
        }

        // Add padding for remaining days
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const nextDate = new Date(year, month + 1, i);
            days.push({ date: nextDate, isCurrentMonth: false, dateString: nextDate.toISOString().split('T')[0] });
        }

        return days;
    }, [currentDate]);

    const today = new Date().toISOString().split('T')[0];

    const navigateMonth = (direction) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + direction);
            return newDate;
        });
    };

    const handleDateClick = (day) => {
        setSelectedDate(day.dateString);
        setShowEventModal(true);
    };

    const handleAddEvent = (e) => {
        e.preventDefault();
        if (!newEventText.trim() || !selectedDate) return;

        onAddEvent({
            date: selectedDate,
            text: newEventText.trim(),
            time: newEventTime,
            reminderEnabled: enableReminder
        });

        setNewEventText('');
        setNewEventTime('09:00');
        setEnableReminder(false);
        setShowEventModal(false);
    };

    const getEventsForDate = (dateString) => events.filter(e => e.date === dateString);

    const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="calendar">
            <div className="calendar-header">
                <h2>Calendar</h2>
                <div className="month-nav">
                    <button className="nav-arrow" onClick={() => navigateMonth(-1)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <span className="month-year">{monthYear}</span>
                    <button className="nav-arrow" onClick={() => navigateMonth(1)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="calendar-grid">
                <div className="weekdays">
                    {weekDays.map(day => (
                        <div key={day} className="weekday">{day}</div>
                    ))}
                </div>

                <div className="days-grid">
                    {calendarDays.map((day, idx) => {
                        const dayEvents = getEventsForDate(day.dateString);
                        const isToday = day.dateString === today;

                        return (
                            <div
                                key={idx}
                                className={`day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
                                onClick={() => handleDateClick(day)}
                            >
                                <span className="day-number">{day.date.getDate()}</span>
                                {dayEvents.length > 0 && (
                                    <div className="event-dots">
                                        {dayEvents.slice(0, 3).map((_, i) => (
                                            <span key={i} className="event-dot"></span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Event Modal */}
            {showEventModal && (
                <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
                    <div className="modal event-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                            <button className="close-btn" onClick={() => setShowEventModal(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Existing Events */}
                            <div className="existing-events">
                                {getEventsForDate(selectedDate).length > 0 ? (
                                    getEventsForDate(selectedDate).map(event => (
                                        <div key={event.id} className="event-item">
                                            <div className="event-content">
                                                <span className="event-time">{event.time}</span>
                                                <span className="event-text">{event.text}</span>
                                            </div>
                                            <button className="event-delete" onClick={() => onDeleteEvent(event.id)}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="no-events">No events for this day</p>
                                )}
                            </div>

                            {/* Add Event Form */}
                            <form onSubmit={handleAddEvent} className="add-event-form">
                                <h4>Add Note</h4>
                                <textarea
                                    className="input"
                                    placeholder="What's happening..."
                                    value={newEventText}
                                    onChange={e => setNewEventText(e.target.value)}
                                    rows={3}
                                />

                                <div className="event-options">
                                    <div className="time-input">
                                        <label>Time</label>
                                        <input type="time" className="input" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} />
                                    </div>

                                    <label className="reminder-toggle">
                                        <input type="checkbox" checked={enableReminder} onChange={e => setEnableReminder(e.target.checked)} />
                                        <span>Remind me</span>
                                    </label>
                                </div>

                                <button type="submit" className="btn btn-primary w-full" disabled={!newEventText.trim()}>
                                    Add Note
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendar;
