import fs from 'fs';
import path from 'path';
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

export const formatReportResponse = (report: any) => {
  const attachments = Array.isArray(report.attachments)
    ? report.attachments.map((att: any) => ({
        ...att,
        url: att.url || `/api/reports/${report.id}/attachments/${att.id}`,
        download_url: `/api/reports/${report.id}/attachments/${att.id}`,
      }))
    : [];
  const primaryAttachment = attachments[0];
  const imageUrl = primaryAttachment ? primaryAttachment.url : (report.imageUrl || report.image_url || null);

  return {
    ...report,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
    attachments,
    image_url: imageUrl,
    reported_by: report.userId,
    assigned_to: report.officerId,
  };
};

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

    const formattedReport = formatReportResponse(report);

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

    const formattedReports = result.data.map((report: any) => formatReportResponse(report));

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

export const search = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Number(req.query.limit ?? '8');
    const results = await reportService.searchReports(req.user, query, limit);

    res.status(200).json({
      status: 'success',
      data: results.map((report: any) => {
        const formatted = formatReportResponse(report);
        return {
          ...report,
          created_at: report.createdAt,
          image_url: formatted.image_url,
          reporter_name: report.user?.fullName || null,
          assigned_officer_name: report.officer?.user?.fullName || null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const getOfficerAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    const result = await reportService.getOfficerAssignments(req.user, req.query);
    const reports = result.data.map((report: any) => formatReportResponse(report));
    res.status(200).json({ status: 'success', data: reports, pagination: result.pagination, items: reports, total: result.pagination.total });
  } catch (error) {
    next(error);
  }
};

export const getOfficerWorkload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    const workload = await reportService.getOfficerWorkload(req.user);
    res.status(200).json({ status: 'success', data: workload });
  } catch (error) {
    next(error);
  }
};

export const updateOfficerStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    const status = req.body.status;
    if (status !== 'IN_PROGRESS' && status !== 'FIXED') {
      return next(new AppError('Officers may update a report only to IN_PROGRESS or FIXED', 400));
    }
    const originalReport = await prisma.report.findUnique({ where: { id: req.params.id as string } });
    if (!originalReport) return next(new AppError('Report not found', 404));
    const report = await reportService.updateReport(req.params.id as string, { status }, req.user);
    const remarks = typeof req.body.remarks === 'string' ? req.body.remarks.trim() : '';
    if (remarks) await reportService.addComment(report.id, req.user, remarks);
    socketService.emitReportUpdated(report);
    socketService.emitStatusChanged(report.id, originalReport.status, report.status, report.userId, report.officerId || undefined);
    await notificationService.createNotification({
      userId: report.userId,
      title: report.status === 'FIXED' ? 'Road Repair Marked Fixed' : 'Report Status Updated',
      message: `Your report "${report.title}" is now ${report.status === 'FIXED' ? 'Fixed and awaiting quality check' : 'Under Repair'}.`,
      type: NotificationType.REPORT,
      reportId: report.id,
    });
    res.status(200).json({ status: 'success', data: { report: formatReportResponse(report) } });
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

    const formattedReport = formatReportResponse(report);

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

      // Assignment has a dedicated event below. Avoid creating both that
      // notification and a generic status update for the same action.
      if (!(newStatus === 'OFFICER_ASSIGNED' && newOfficerId && oldOfficerId !== newOfficerId)) {
      const notifType = ['FIXED', 'COMPLETED', 'CLOSED'].includes(newStatus) ? NotificationType.SUCCESS : (newStatus === 'REJECTED' ? NotificationType.WARNING : NotificationType.REPORT);
      const statusText: Record<string, string> = { FIXED: 'Fixed — awaiting quality check', QUALITY_CHECK: 'under quality check', COMPLETED: 'Completed', CLOSED: 'Closed', IN_PROGRESS: 'Under Repair', OFFICER_ASSIGNED: 'Assigned', AI_VERIFIED: 'AI Verified', NEEDS_REVIEW: 'Needs Review', REJECTED: 'Rejected' };

      await notificationService.createNotification({
        userId: report.userId,
        title: newStatus === 'CLOSED' ? 'Report Closed' : newStatus === 'COMPLETED' ? 'Repair Quality Approved' : newStatus === 'FIXED' ? 'Road Repair Completed' : 'Report Status Updated',
        message: `Your report "${report.title}" is now ${statusText[newStatus] || newStatus}.`,
        type: notifType,
        reportId: report.id,
      });
      }
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

    const formattedReport = formatReportResponse(report);

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
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    const reports = await reportService.getMapReports(req.user);
    res.status(200).json({
      status: 'success',
      data: reports,
    });
  } catch (error) {
    next(error);
  }
};

export const getAttachment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const id = req.params.id as string;
    const attachmentId = req.params.attachmentId as string;

    // Verify caller has permission to view this report via RBAC
    await reportService.getReportById(id, req.user);

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        reportId: id,
      },
    });

    if (!attachment) {
      return next(new AppError('Attachment not found', 404));
    }

    const safeRelativePath = attachment.url.replace(/^\/+/, '');
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const safeFilePath = path.resolve(process.cwd(), safeRelativePath);

    if (!safeFilePath.startsWith(uploadsDir) || !fs.existsSync(safeFilePath)) {
      return next(new AppError('Attachment file not found', 404));
    }

    res.sendFile(safeFilePath);
  } catch (error) {
    next(error);
  }
};

