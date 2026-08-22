import prisma from '../config/db';
import { analyzeReportImage } from './aiService';
import {
  CreateReportInput,
  UpdateReportInput,
} from '../validations/reportValidation';
import { AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export const createReport = async (userId: string, input: CreateReportInput) => {
  const { imageUrl, ...reportData } = input;

  return prisma.report.create({
    data: {
      ...reportData,
      userId,
      attachments: imageUrl
        ? {
            create: {
              url: imageUrl,
              fileType: 'IMAGE',
            },
          }
        : undefined,
    },
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
      attachments: true,
    },
  });
};

export const getReports = async (
  user: { userId: string; role: string },
  filters: any
) => {
  const page = Math.max(1, parseInt(filters.page || '1', 10));
  const limit = Math.max(1, parseInt(filters.limit || '10', 10));
  const skip = (page - 1) * limit;

  const where: Prisma.ReportWhereInput = {};
  let officerRecord: { id: string } | null = null;

  if (user.role === 'OFFICER') {
    officerRecord = await prisma.officer.findFirst({
      where: { userId: user.userId },
      select: { id: true },
    });
  }

  // 1. Role-based visibility
  if (user.role === 'USER') {
    where.userId = user.userId;
  } else if (user.role === 'OFFICER') {
    if (filters.mine === 'true' || filters.mine === true) {
      where.userId = user.userId;
    } else if (officerRecord?.id) {
      where.officerId = officerRecord.id;
    } else {
      // An OFFICER account without its required Officer profile must never fall
      // back to an unrestricted report query.
      where.id = { in: [] };
    }
  } else if (filters.mine === 'true' || filters.mine === true) {
    where.userId = user.userId;
  }

  // 2. Search filter
  if (filters.search) {
    const searchStr = String(filters.search);
    where.OR = [
      { title: { contains: searchStr, mode: 'insensitive' } },
      { description: { contains: searchStr, mode: 'insensitive' } },
      { address: { contains: searchStr, mode: 'insensitive' } },
      { city: { contains: searchStr, mode: 'insensitive' } },
    ];
  }

  // 3. Enums and relational filters
  if (filters.severity) {
    where.severity = filters.severity;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  }
  if (filters.officerId) {
    where.officerId = filters.officerId;
  }

  // 4. Fetch data & total count
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
        department: true,
        officer: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        attachments: true,
        aiResults: {
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return {
    data: reports,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/** Returns only the work assigned to the authenticated officer. */
export const getOfficerAssignments = async (
  user: { userId: string; role: string },
  filters: any
) => {
  if (user.role !== 'OFFICER') {
    throw new AppError('Access forbidden: officer role required', 403);
  }

  return getReports(user, { ...filters, mine: 'false' });
};

export const getOfficerWorkload = async (user: { userId: string; role: string }) => {
  const result = await getOfficerAssignments(user, { page: '1', limit: '1000' });
  const reports = result.data;
  const count = (status: string) => reports.filter((report) => report.status === status).length;

  return {
    totalAssignedReports: result.pagination.total,
    pendingReports: count('OFFICER_ASSIGNED'),
    inRepair: count('IN_PROGRESS'),
    fixedReports: count('FIXED'),
    qualityCheckReports: count('QUALITY_CHECK'),
    completedReports: count('COMPLETED'),
    closedReports: count('CLOSED'),
    recentAssignments: reports.slice(0, 6),
  };
};

export const getReportById = async (
  id: string,
  user: { userId: string; role: string }
) => {
  const officerRecord = user.role === 'OFFICER'
    ? await prisma.officer.findFirst({
        where: { userId: user.userId },
        select: { id: true },
      })
    : null;

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
      department: true,
      officer: {
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, fullName: true } },
        },
      },
      attachments: true,
      aiResults: true,
    },
  });

  if (!report) {
    throw new AppError('Report not found', 404);
  }

  if (user.role === 'USER' && report.userId !== user.userId) {
    throw new AppError('Access forbidden to this report', 403);
  }

  if (user.role === 'OFFICER' && report.officerId !== officerRecord?.id) {
    throw new AppError('Access forbidden to this report', 403);
  }

  return report;
};

export const updateReport = async (
  id: string,
  input: UpdateReportInput,
  user: { userId: string; role: string }
) => {
  const report = await prisma.report.findUnique({
    where: { id },
  });

  if (!report) {
    throw new AppError('Report not found', 404);
  }

  let updateData: any = { ...input };

  if (user.role === 'USER' && report.userId !== user.userId) {
    throw new AppError('Access forbidden to update this report', 403);
  }

  if (user.role === 'ADMIN' && input.status && input.status !== report.status) {
    const allowedTransitions: Record<string, string[]> = {
      REPORTED: ['AI_VERIFIED', 'NEEDS_REVIEW', 'REJECTED', 'OFFICER_ASSIGNED'],
      AI_VERIFIED: ['NEEDS_REVIEW', 'REJECTED', 'OFFICER_ASSIGNED'],
      NEEDS_REVIEW: ['AI_VERIFIED', 'REJECTED', 'OFFICER_ASSIGNED'],
      FIXED: ['QUALITY_CHECK'],
      QUALITY_CHECK: ['COMPLETED'],
      COMPLETED: ['CLOSED'],
    };
    if (!allowedTransitions[report.status]?.includes(input.status)) {
      throw new AppError('Invalid administrative report status transition', 403);
    }
  }

  if (user.role === 'OFFICER') {
    const officerRecord = await prisma.officer.findFirst({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (report.officerId !== officerRecord?.id) {
      throw new AppError('Access forbidden to update this report', 403);
    }

    if (input.status) {
      const allowedTransitions: Record<string, string[]> = {
        OFFICER_ASSIGNED: ['IN_PROGRESS'],
        IN_PROGRESS: ['FIXED'],
      };
      if (!allowedTransitions[report.status]?.includes(input.status)) {
        throw new AppError('Officers can only move an assigned report to In Repair, then Fixed', 403);
      }
    }

    const { officerId, departmentId, ...officerAllowedData } = input as any;
    updateData = officerAllowedData;
  }

  // USER role cannot alter status, departmentId or officerId
  if (user.role === 'USER') {
    const { status, departmentId, officerId, ...allowedData } = input as any;
    updateData = allowedData;
  }

  if (input.officerId) {
    if (user.role !== 'ADMIN') {
      throw new AppError('Only Admin can assign officers to reports', 403);
    }
    const officer = await prisma.officer.findUnique({
      where: { id: input.officerId },
      include: { user: true, department: true },
    });
    if (!officer || officer.user.role !== 'OFFICER') {
      throw new AppError('Selected officer is invalid or not an officer account', 400);
    }
    if (!input.departmentId) {
      updateData.departmentId = officer.departmentId;
    }
    if (!input.status && (report.status === 'REPORTED' || report.status === 'AI_VERIFIED' || report.status === 'NEEDS_REVIEW')) {
      updateData.status = 'OFFICER_ASSIGNED';
    }
  }

  return prisma.report.update({
    where: { id },
    data: updateData,
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
      department: true,
      officer: {
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
      attachments: true,
    },
  });
};

export const deleteReport = async (
  id: string,
  user: { userId: string; role: string }
) => {
  const report = await prisma.report.findUnique({
    where: { id },
  });

  if (!report) {
    throw new AppError('Report not found', 404);
  }

  if (user.role === 'USER' && report.userId !== user.userId) {
    throw new AppError('Access forbidden to delete this report', 403);
  }

  if (user.role === 'OFFICER') {
    throw new AppError('Officers are not permitted to delete reports', 403);
  }

  await prisma.report.delete({
    where: { id },
  });

  return true;
};

export const getComments = async (
  reportId: string,
  user: { userId: string; role: string }
) => {
  await getReportById(reportId, user);

  const comments = await prisma.comment.findMany({
    where: { reportId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: { id: true, fullName: true, role: true },
      },
    },
  });

  return comments.map((c) => ({
    id: c.id,
    report_id: c.reportId,
    user_id: c.userId,
    comment: c.content,
    content: c.content,
    created_at: c.createdAt,
    user: c.user,
  }));
};

export const addComment = async (
  reportId: string,
  user: { userId: string; role: string },
  content: string
) => {
  await getReportById(reportId, user);

  const newComment = await prisma.comment.create({
    data: {
      reportId,
      userId: user.userId,
      content,
    },
    include: {
      user: {
        select: { id: true, fullName: true, role: true },
      },
    },
  });

  return {
    id: newComment.id,
    report_id: newComment.reportId,
    user_id: newComment.userId,
    comment: newComment.content,
    content: newComment.content,
    created_at: newComment.createdAt,
    user: newComment.user,
  };
};

export const getMapReports = async (user: { userId: string; role: string }) => {
  let where: Prisma.ReportWhereInput = {};
  if (user.role === 'USER') {
    // Citizens have the same map visibility as their report list: their own reports.
    where = { userId: user.userId };
  } else if (user.role === 'OFFICER') {
    const officer = await prisma.officer.findUnique({ where: { userId: user.userId }, select: { id: true } });
    where = officer ? { officerId: officer.id } : { id: { in: [] } };
  }
  return prisma.report.findMany({
    where,
    select: {
      id: true,
      title: true,
      latitude: true,
      longitude: true,
      severity: true,
      status: true,
      createdAt: true,
      address: true,
      city: true,
      description: true,
      user: { select: { fullName: true } },
      department: { select: { name: true } },
      officer: {
        include: {
          user: { select: { fullName: true } },
        },
      },
      attachments: { select: { url: true }, take: 1 },
      aiResults: { select: { confidenceScore: true, potholeDetected: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
