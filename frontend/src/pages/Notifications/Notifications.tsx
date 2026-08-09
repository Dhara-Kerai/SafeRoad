import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiInbox } from 'react-icons/fi';
import { useNotifications } from '../../hooks/useNotifications';
import {
  NotificationItem,
  NotificationFilters,
} from '../../components/Notification';
import type { FilterType } from '../../components/Notification/NotificationFilters';
import './Notifications.css';

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleDelete = (id: string) => {
    deleteNotification(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleOpenReport = (reportId: string) => {
    navigate(`/report/${reportId}`);
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (activeFilter === 'unread' && notif.read) {
      return false;
    }
    if (
      activeFilter !== 'all' &&
      activeFilter !== 'unread' &&
      notif.type !== activeFilter
    ) {
      return false;
    }

    const query = searchQuery.toLowerCase().trim();
    if (query) {
      return (
        notif.title.toLowerCase().includes(query) ||
        notif.message.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <main className="notification-page">
      <header className="notification-page__header">
        <div>
          <h1>Notifications</h1>
          <p
            className="notification-page__subtitle"
            style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}
          >
            Manage alerts, reports, and administrative announcements.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="notification-page__mark-all-btn"
            onClick={handleMarkAllAsRead}
          >
            <FiCheckCircle /> Mark all as read
          </button>
        )}
      </header>

      <NotificationFilters
        activeFilter={activeFilter}
        onChangeFilter={setActiveFilter}
        searchQuery={searchQuery}
        onChangeSearchQuery={setSearchQuery}
      />

      <section className="notification-list" role="list">
        {loading ? (
          <div className="notification-empty">
            <p>Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="notification-empty">
            <FiInbox size={48} />
            <h3>Unable to load notifications</h3>
            <p>{error}</p>
            <button
              type="button"
              className="notification-item__report-btn"
              onClick={() => void refreshNotifications()}
            >
              Retry
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notification-empty">
            <FiInbox size={48} />
            <h3>No notifications found</h3>
            <p>
              {searchQuery || activeFilter !== 'all'
                ? "Try adjusting your filters or search terms to find what you're looking for."
                : 'You are all caught up! No notifications at this time.'}
            </p>
            {(searchQuery || activeFilter !== 'all') && (
              <button
                type="button"
                className="notification-item__report-btn"
                style={{ marginTop: 0 }}
                onClick={() => {
                  setActiveFilter('all');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onMarkAsRead={handleMarkAsRead}
              onDelete={handleDelete}
              onClickReport={handleOpenReport}
            />
          ))
        )}
      </section>
    </main>
  );
};
export default Notifications;
