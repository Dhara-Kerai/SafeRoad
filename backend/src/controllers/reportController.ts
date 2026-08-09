import { Request, Response, NextFunction } from 'express';
import {
  createReportSchema,
  updateReportSchema,
} from '../validations/reportValidation';
import * as reportService from '../services/reportService';
import { AppError } from '../middleware/errorHandler';
import { analyzeReportImage } from '../services/aiService';
import { NotificationType } from '@prisma/client';
import * as notificationService from '../services/notificationService';
import * as socketService from '../services/socketService';
import prisma from '../config/db';

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    // Adapt frontend snake_case attributes
    if (req.body.image_url && !req.body.imageUrl) {
      req.body.imageUrl = req.body.image_url;
    }
    if (!req.body.city) {
      req.body.city = req.body.address?.split(', ').at(-1) || 'Unknown';
    }

    const parseResult = createReportSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((e: { message: string }) => e.message)
        .join(', ');
      return next(new AppError(errorMsg, 400));
    }

    const report = await reportService.createReport(
      req.user.userId,
      parseResult.data
    );

    let aiResult = null;
    let warning: string | undefined = undefined;

    if (parseResult.data.imageUrl) {
      aiResult = await analyzeReportImage(report.id, parseResult.data.imageUrl);
      if (!aiResult) {
        warning =
          'AI analysis is pending: AI service is currently unavailable or timed out.';
      } else {
        let finalStatus = 'REPORTED';
        if (aiResult.potholeDetected && aiResult.confidenceScore >= 0.7) {
          finalStatus = 'AI_VERIFIED';
        } else {
          finalStatus = 'NEEDS_REVIEW';
        }

        await prisma.report.update({
          where: { id: report.id },
          data: { status: finalStatus as any },
        });
        report.status = finalStatus as any;
      }
    }

    // 1. Emit Report Created websocket event
    socketService.emitReportCreated(report);

    // 2. Persist notification for report creator
    await notificationService.createNotification({
      userId: report.userId,
      title: 'Report Submitted',
      message: `Your report "${report.title}" was submitted successfully.`,
      type: NotificationType.REPORT,
      reportId: report.id,
    });

    // 3. Persist notification for Admin users
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    for (const admin of adminUsers) {
      if (admin.id !== report.userId) {
        await notificationService.createNotification({
          userId: admin.id,
          title: 'New Pothole Report',
          message: `A new report "${report.title}" was submitted in ${report.city}.`,
          type: NotificationType.ADMIN,
          reportId: report.id,
        });
      }
    }

    // 4. Persist AI Analysis notification if AI analyzed
    if (aiResult) {
      await notificationService.createNotification({
        userId: report.userId,
        title: 'AI Verification Completed',
        message: aiResult.potholeDetected
          ? `AI verified pothole in report "${report.title}" with confidence ${Math.round(aiResult.confidenceScore * 100)}%.`
          : `AI finished analysis of report "${report.title}". No potholes were detected.`,
        type: aiResult.potholeDetected ? NotificationType.SUCCESS : NotificationType.WARNING,
        reportId: report.id,
      });
    }

    const formattedReport = {
      ...report,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
      image_url: report.attachments?.[0]?.url || null,
      reported_by: report.userId,
      assigned_to: report.officerId,
    };

    // Destructure status to prevent duplicate property error in TS when spreading
    const { status, ...reportRest } = formattedReport;

    res.status(201).json({
      ...reportRest,
      status, // Set explicitly
      data: {
        report: formattedReport,
        aiResult,
      },
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    next(error);
  }
};

export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    // Convert frontend size parameter to backend limit query parameter
    if (req.query.size && !req.query.limit) {
      req.query.limit = req.query.size;
    }

    const result = await reportService.getReports(req.user, req.query);

    const formattedReports = result.data.map((report: any) => ({
      ...report,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
      image_url: report.attachments?.[0]?.url || null,
      reported_by: report.userId,
      assigned_to: report.officerId,
    }));

    res.status(200).json({
      status: 'success',
      data: formattedReports,
      pagination: result.pagination,
      // Frontend pagination contract properties
      items: formattedReports,
      total: result.pagination.total,
      page: result.pagination.page,
      size: result.pagination.limit,
    });
  } catch (error) {
    next(error);
  }
};

export const getById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const id = req.params.id as string;
    const report = await reportService.getReportById(id, req.user);
    if (!report) {
      return next(new AppError('Report not found', 404));
    }

    const formattedReport = {
      ...report,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
      image_url: report.attachments?.[0]?.url || null,
      reported_by: report.userId,
      assigned_to: report.officerId,
    };

    const { status, ...reportRest } = formattedReport;

    res.status(200).json({
      ...reportRest,
      status, // Set explicitly
      data: { report: formattedReport },
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const id = req.params.id as string;

    // Adapt frontend snake_case attributes
    if (req.body.image_url && !req.body.imageUrl) {
      req.body.imageUrl = req.body.image_url;
    }

    const parseResult = updateReportSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((e: { message: string }) => e.message)
        .join(', ');
      return next(new AppError(errorMsg, 400));
    }

    // Retrieve original report state to identify modified status/assignments
    const originalReport = await prisma.report.findUnique({
      where: { id },
    });

    if (!originalReport) {
      return next(new AppError('Report not found', 404));
    }

    const report = await reportService.updateReport(
      id,
      parseResult.data,
      req.user
    );

    const oldStatus = originalReport.status;
    const newStatus = report.status;
    const oldOfficerId = originalReport.officerId;
    const newOfficerId = report.officerId;

    // 1. Emit base report-updated event
    socketService.emitReportUpdated(report);

    // 2. Emit status changed events & persist DB notification
    if (oldStatus !== newStatus) {
      socketService.emitStatusChanged(
        report.id,
        oldStatus,
        newStatus,
        report.userId,
        report.officerId || undefined
      );

      const notifType = newStatus === 'FIXED' ? NotificationType.SUCCESS : (newStatus === 'REJECTED' ? NotificationType.WARNING : NotificationType.REPORT);
      const statusText = newStatus === 'FIXED' ? 'Resolved' : (newStatus === 'IN_PROGRESS' ? 'Under Repair' : (newStatus === 'OFFICER_ASSIGNED' ? 'Assigned' : newStatus));

      await notificationService.createNotification({
        userId: report.userId,
        title: newStatus === 'FIXED' ? 'Road Repair Completed' : 'Report Status Updated',
        message: `Your report "${report.title}" is now ${statusText}.`,
        type: notifType,
        reportId: report.id,
      });
    }

    // 3. Emit report assigned event & persist DB notification
    if (newOfficerId && oldOfficerId !== newOfficerId) {
      socketService.emitReportAssigned(report.id, newOfficerId);

      const officerRecord = await prisma.officer.findUnique({
        where: { id: newOfficerId },
        select: { userId: true },
      });

      if (officerRecord?.userId) {
        await notificationService.createNotification({
          userId: officerRecord.userId,
          title: 'Officer Assigned',
          message: `You have been assigned to pothole report "${report.title}".`,
          type: NotificationType.ASSIGNMENT,
          reportId: report.id,
        });
      }

      if (report.userId) {
        await notificationService.createNotification({
          userId: report.userId,
          title: 'Officer Assigned',
          message: `An officer has been assigned to inspect and resolve your report "${report.title}".`,
          type: NotificationType.ASSIGNMENT,
          reportId: report.id,
        });
      }
    }

    const formattedReport = {
      ...report,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
      image_url: report.attachments?.[0]?.url || null,
      reported_by: report.userId,
      assigned_to: report.officerId,
    };

    const { status, ...reportRest } = formattedReport;

    res.status(200).json({
      ...reportRest,
      status, // Set explicitly
      data: { report: formattedReport },
    });
  } catch (error) {
    next(error);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const id = req.params.id as string;
    await reportService.deleteReport(id, req.user);
    res.status(200).json({
      status: 'success',
      message: 'Report deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getComments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const id = req.params.id as string;
    const comments = await reportService.getComments(id, req.user);
    res.status(200).json(comments);
  } catch (error) {
    next(error);
  }
};

export const addComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const id = req.params.id as string;
    const content = req.body.comment || req.body.content;
    if (!content || typeof content !== 'string') {
      return next(new AppError('Comment text is required', 400));
    }

    const comment = await reportService.addComment(id, req.user, content);
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const getMapReports = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const reports = await reportService.getMapReports();
    res.status(200).json({
      status: 'success',
      data: reports,
    });
  } catch (error) {
    next(error);
  }
};

