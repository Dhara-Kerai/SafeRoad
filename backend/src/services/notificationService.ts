import prisma from '../config/db';
import { NotificationType } from '@prisma/client';
import * as socketService from './socketService';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  reportId?: string;
}

export const createNotification = async (input: CreateNotificationInput) => {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type || NotificationType.REPORT,
      reportId: input.reportId || null,
      read: false,
    },
  });

  const formatted = {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type.toLowerCase(),
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
    reportId: notification.reportId || undefined,
  };

  // Emit real-time Socket.IO notification event to the specific user's room
  socketService.emitNotification([`user:${input.userId}`], formatted);

  return formatted;
};

export const getUserNotifications = async (userId: string) => {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type.toLowerCase(),
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      reportId: n.reportId || undefined,
    })),
    unreadCount,
  };
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  return prisma.notification.count({
    where: { userId, read: false },
  });
};


export const markAsRead = async (notificationId: string, userId: string) => {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    return null;
  }

  if (existing.userId !== userId) {
    const error = new Error('Access forbidden: You cannot update another user\'s notification') as any;
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  return {
    id: updated.id,
    title: updated.title,
    message: updated.message,
    type: updated.type.toLowerCase(),
    read: updated.read,
    createdAt: updated.createdAt.toISOString(),
    reportId: updated.reportId || undefined,
  };
};

export const markAllAsRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return getUserNotifications(userId);
};

export const deleteNotification = async (notificationId: string, userId: string) => {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    return null;
  }

  if (existing.userId !== userId) {
    const error = new Error('Access forbidden: You cannot delete another user\'s notification') as any;
    error.statusCode = 403;
    throw error;
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return true;
};
