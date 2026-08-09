import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '../types/notification';
import * as service from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { getSocket, joinUserRoom } from '../services/socketService';

let listeners: Array<(notifications: Notification[]) => void> = [];

const notifyListeners = (newNotifications: Notification[]) => {
  listeners.forEach((listener) => listener(newNotifications));
};

export const useNotifications = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await service.fetchNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      notifyListeners(data.notifications);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Sync state across multiple hook instances
  useEffect(() => {
    const handleUpdate = (updatedList: Notification[]) => {
      setNotifications(updatedList);
      setUnreadCount(updatedList.filter((n) => !n.read).length);
    };

    listeners.push(handleUpdate);

    return () => {
      listeners = listeners.filter((l) => l !== handleUpdate);
    };
  }, []);

  // Realtime Socket.IO listener for incoming notifications
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    joinUserRoom(currentUser);
    const socket = getSocket();

    const handleRealtimeNotification = (incoming: Notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incoming.id)) {
          return prev;
        }
        const updated = [incoming, ...prev];
        notifyListeners(updated);
        return updated;
      });
      setUnreadCount((prev) => prev + (incoming.read ? 0 : 1));
    };

    socket.on('notification', handleRealtimeNotification);

    return () => {
      socket.off('notification', handleRealtimeNotification);
    };
  }, [isAuthenticated, currentUser]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      notifyListeners(updated);
      return updated;
    });
    setUnreadCount((prev) => Math.max(0, prev - 1));

    const result = await service.markAsRead(id);
    if (!result) {
      void loadNotifications();
    }
  }, [loadNotifications]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      notifyListeners(updated);
      return updated;
    });
    setUnreadCount(0);

    await service.markAllAsRead();
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      const updated = prev.filter((n) => n.id !== id);
      notifyListeners(updated);
      return updated;
    });

    const success = await service.deleteNotification(id);
    if (!success) {
      void loadNotifications();
    }
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications: loadNotifications,
  };
};
