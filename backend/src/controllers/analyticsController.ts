import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analyticsService';
import { AppError } from '../middleware/errorHandler';

const hasRole = (req: Request, allowed: string[]): boolean => {
  if (!req.user) return false;
  return allowed.includes(req.user.role);
};

export const getDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!hasRole(req, ['USER', 'OFFICER', 'ADMIN'])) {
      return next(
        new AppError('Access forbidden: insufficient permissions', 403)
      );
    }
    const data = await analyticsService.getDashboardStats(req.user);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

export const getStatusDistribution = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!hasRole(req, ['ADMIN'])) {
      return next(
        new AppError('Access forbidden: insufficient permissions', 403)
      );
    }
    const data = await analyticsService.getStatusDistribution();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getSeverityDistribution = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!hasRole(req, ['ADMIN'])) {
      return next(
        new AppError('Access forbidden: insufficient permissions', 403)
      );
    }
    const data = await analyticsService.getSeverityDistribution();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getReportsByCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!hasRole(req, ['ADMIN'])) {
      return next(
        new AppError('Access forbidden: insufficient permissions', 403)
      );
    }
    const data = await analyticsService.getReportsByCity();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getMonthlyTrends = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!hasRole(req, ['ADMIN'])) {
      return next(
        new AppError('Access forbidden: insufficient permissions', 403)
      );
    }
    const data = await analyticsService.getMonthlyTrends(req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getDepartmentPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!hasRole(req, ['ADMIN'])) {
      return next(
        new AppError('Access forbidden: insufficient permissions', 403)
      );
    }
    const data = await analyticsService.getDepartmentPerformance();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getOfficerPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!hasRole(req, ['ADMIN'])) {
      return next(
        new AppError('Access forbidden: insufficient permissions', 403)
      );
    }
    const data = await analyticsService.getOfficerPerformance();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getRecent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!hasRole(req, ['ADMIN'])) {
      return next(
        new AppError('Access forbidden: insufficient permissions', 403)
      );
    }
    const data = await analyticsService.getRecentReports();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
