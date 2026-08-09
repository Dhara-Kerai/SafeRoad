import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notificationService';
import { AppError } from '../middleware/errorHandler';

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const data = await notificationService.getUserNotifications(req.user.userId);
    res.status(200).json({
      status: 'success',
      data: data.notifications,
      unreadCount: data.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const unreadCount = await notificationService.getUnreadCount(req.user.userId);
    res.status(200).json({
      status: 'success',
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};


export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const id = req.params.id as string;
    const updated = await notificationService.markAsRead(id, req.user.userId);

    if (!updated) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    if (error.statusCode === 403) {
      return next(new AppError(error.message, 403));
    }
    next(error);
  }
};

export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const data = await notificationService.markAllAsRead(req.user.userId);
    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
      data: data.notifications,
      unreadCount: data.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const id = req.params.id as string;
    const deleted = await notificationService.deleteNotification(id, req.user.userId);

    if (!deleted) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted',
    });
  } catch (error: any) {
    if (error.statusCode === 403) {
      return next(new AppError(error.message, 403));
    }
    next(error);
  }
};
