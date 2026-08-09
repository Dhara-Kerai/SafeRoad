import prisma from '../config/db';

export const getDashboardStats = async (user?: { userId: string; role: string }) => {
  if (user?.role === 'OFFICER') {
    const officerRecord = await prisma.officer.findFirst({
      where: { userId: user.userId },
      select: { id: true },
    });

    const officerId = officerRecord?.id;

    if (!officerId) {
      return {
        totalAssignedReports: 0,
        pendingVerification: 0,
        aiVerifiedReports: 0,
        reportsNeedsReview: 0,
        inRepair: 0,
        completedReports: 0,
      };
    }

    const [
      totalAssignedReports,
      pendingVerification,
      aiVerifiedReports,
      reportsNeedsReview,
      inRepair,
      completedReports,
    ] = await Promise.all([
      prisma.report.count({ where: { officerId } }),
      prisma.report.count({ where: { officerId, status: 'REPORTED' } }),
      prisma.report.count({ where: { officerId, status: 'AI_VERIFIED' } }),
      prisma.report.count({ where: { officerId, status: 'NEEDS_REVIEW' } }),
      prisma.report.count({ where: { officerId, status: { in: ['OFFICER_ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.report.count({ where: { officerId, status: 'FIXED' } }),
    ]);

    return {
      totalAssignedReports,
      pendingVerification,
      aiVerifiedReports,
      reportsNeedsReview,
      inRepair,
      completedReports,
    };
  }

  if (user?.role === 'USER') {
    const [
      totalReports,
      resolvedReports,
      pendingReports,
      inProgressReports,
      highSeverity,
      mediumSeverity,
      lowSeverity,
      aiVerifiedReports,
    ] = await Promise.all([
      prisma.report.count({ where: { userId: user.userId } }),
      prisma.report.count({ where: { userId: user.userId, status: 'FIXED' } }),
      prisma.report.count({ where: { userId: user.userId, status: { in: ['REPORTED', 'AI_VERIFIED'] } } }),
      prisma.report.count({ where: { userId: user.userId, status: { in: ['OFFICER_ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.report.count({ where: { userId: user.userId, severity: { in: ['HIGH', 'CRITICAL'] } } }),
      prisma.report.count({ where: { userId: user.userId, severity: 'MEDIUM' } }),
      prisma.report.count({ where: { userId: user.userId, severity: 'LOW' } }),
      prisma.report.count({ where: { userId: user.userId, status: 'AI_VERIFIED' } }),
    ]);

    return {
      totalReports,
      resolvedReports,
      pendingReports,
      inProgressReports,
      highSeverity,
      mediumSeverity,
      lowSeverity,
      aiVerifiedReports,
    };
  }

  const [
    totalReports,
    resolvedReports,
    pendingReports,
    inProgressReports,
    highSeverity,
    mediumSeverity,
    lowSeverity,
    activeUsers,
    activeOfficers,
    departments,
  ] = await Promise.all([
    // Total Reports
    prisma.report.count(),

    // Resolved Reports (FIXED)
    prisma.report.count({ where: { status: 'FIXED' } }),

    // Pending Reports (REPORTED & AI_VERIFIED)
    prisma.report.count({
      where: {
        status: { in: ['REPORTED', 'AI_VERIFIED'] },
      },
    }),

    // In Progress Reports (OFFICER_ASSIGNED & IN_PROGRESS)
    prisma.report.count({
      where: {
        status: { in: ['OFFICER_ASSIGNED', 'IN_PROGRESS'] },
      },
    }),

    // High Severity (HIGH & CRITICAL)
    prisma.report.count({
      where: {
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    }),

    // Medium Severity
    prisma.report.count({ where: { severity: 'MEDIUM' } }),

    // Low Severity
    prisma.report.count({ where: { severity: 'LOW' } }),

    // Active Citizens
    prisma.user.count({ where: { role: 'USER' } }),

    // Active Officers
    prisma.officer.count(),

    // Departments
    prisma.department.count(),
  ]);

  return {
    totalReports,
    resolvedReports,
    pendingReports,
    inProgressReports,
    highSeverity,
    mediumSeverity,
    lowSeverity,
    activeUsers,
    activeOfficers,
    departments,
  };
};

export const getStatusDistribution = async () => {
  const distribution = await prisma.report.groupBy({
    by: ['status'],
    _count: {
      _all: true,
    },
  });

  return distribution.map((item) => ({
    status: item.status,
    count: item._count._all,
  }));
};

export const getSeverityDistribution = async () => {
  const distribution = await prisma.report.groupBy({
    by: ['severity'],
    _count: {
      _all: true,
    },
  });

  return distribution.map((item) => ({
    severity: item.severity,
    count: item._count._all,
  }));
};

export const getReportsByCity = async () => {
  const distribution = await prisma.report.groupBy({
    by: ['city'],
    _count: {
      _all: true,
    },
  });

  return distribution.map((item) => ({
    city: item.city,
    count: item._count._all,
  }));
};

export const getMonthlyTrends = async () => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  // Fetch report creation dates in the range
  const reports = await prisma.report.findMany({
    where: {
      createdAt: {
        gte: twelveMonthsAgo,
      },
    },
    select: {
      createdAt: true,
    },
  });

  // Prepare a map of the last 12 months with default count = 0
  const monthlyCounts: { [key: string]: number } = {};
  const current = new Date(twelveMonthsAgo);

  for (let i = 0; i < 12; i++) {
    const year = current.getFullYear();
    const month = (current.getMonth() + 1).toString().padStart(2, '0');
    const monthKey = `${year}-${month}`;
    monthlyCounts[monthKey] = 0;

    // Advance to next month
    current.setMonth(current.getMonth() + 1);
  }

  // Populate counts
  reports.forEach((report) => {
    const date = new Date(report.createdAt);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthKey = `${year}-${month}`;
    if (monthlyCounts[monthKey] !== undefined) {
      monthlyCounts[monthKey]++;
    }
  });

  // Convert to formatted list
  return Object.keys(monthlyCounts)
    .sort()
    .map((month) => ({
      month,
      reports: monthlyCounts[month],
    }));
};

export const getDepartmentPerformance = async () => {
  const departments = await prisma.department.findMany({
    include: {
      _count: {
        select: {
          reports: true,
        },
      },
      reports: {
        select: {
          status: true,
        },
      },
    },
  });

  return departments.map((d) => {
    const assigned = d._count.reports;
    const completed = d.reports.filter((r) => r.status === 'FIXED').length;
    const completionRate =
      assigned > 0
        ? parseFloat(((completed / assigned) * 100).toFixed(1))
        : 0.0;

    return {
      department: d.name,
      assigned,
      completed,
      completionRate,
    };
  });
};

export const getOfficerPerformance = async () => {
  const officers = await prisma.officer.findMany({
    include: {
      user: {
        select: {
          fullName: true,
        },
      },
      _count: {
        select: {
          reports: true,
        },
      },
      reports: {
        select: {
          status: true,
        },
      },
    },
  });

  return officers.map((o) => {
    const assigned = o._count.reports;
    const completed = o.reports.filter((r) => r.status === 'FIXED').length;
    const completionRate =
      assigned > 0
        ? parseFloat(((completed / assigned) * 100).toFixed(1))
        : 0.0;

    return {
      officer: o.user.fullName,
      assigned,
      completed,
      completionRate,
    };
  });
};

export const getRecentReports = async () => {
  return prisma.report.findMany({
    take: 10,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      city: true,
      severity: true,
      status: true,
      createdAt: true,
    },
  });
};
