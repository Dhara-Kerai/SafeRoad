import { authenticatedRequestJson } from './authService';
import type { Notification } from '../types/notification';

export interface NotificationResponse {
  status: string;
  data: Notification[];
  unreadCount: number;
}

export const fetchNotifications = async (): Promise<{ notifications: Notification[]; unreadCount: number }> => {
  try {
    const res = await authenticatedRequestJson<NotificationResponse>('/notifications');
    return {
      notifications: Array.isArray(res.data) ? res.data : [],
      unreadCount: typeof res.unreadCount === 'number' ? res.unreadCount : 0,
    };
  } catch (error) {
    console.error('Failed to fetch notifications from backend:', error);
    throw error;
  }
};

export const markAsRead = async (id: string): Promise<Notification | null> => {
  try {
    const res = await authenticatedRequestJson<{ status: string; data: Notification }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
    return res.data;
  } catch (error) {
    console.error(`Failed to mark notification ${id} as read:`, error);
    return null;
  }
};

export const markAllAsRead = async (): Promise<{ notifications: Notification[]; unreadCount: number }> => {
  try {
    const res = await authenticatedRequestJson<NotificationResponse>('/notifications/read-all', {
      method: 'PATCH',
    });
    return {
      notifications: Array.isArray(res.data) ? res.data : [],
      unreadCount: typeof res.unreadCount === 'number' ? res.unreadCount : 0,
    };
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return { notifications: [], unreadCount: 0 };
  }
};

export const deleteNotification = async (id: string): Promise<boolean> => {
  try {
    await authenticatedRequestJson<{ status: string }>(`/notifications/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error(`Failed to delete notification ${id}:`, error);
    return false;
  }
};
