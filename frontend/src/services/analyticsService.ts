import { authenticatedRequestJson } from './authService';
import type { AnalyticsFilters, AnalyticsReport, NamedValue } from '../types/analytics';
import type { MapSeverity } from '../types/map';

export interface DashboardStats {
  totalReports: number;
  resolvedReports: number;
  pendingReports: number;
  inProgressReports: number;
  highSeverity: number;
  mediumSeverity?: number;
  lowSeverity?: number;
  aiVerifiedReports?: number;
  activeUsers?: number;
  activeOfficers?: number;
  departments?: number;
}

export interface RecentReportItem {
  id: string;
  title: string;
  city: string;
  severity: string;
  status: string;
  createdAt: string;
}

export interface StatusDistributionItem {
  status: string;
  count: number;
}

export interface SeverityDistributionItem {
  severity: string;
  count: number;
}

export interface CityDistributionItem {
  city: string;
  count: number;
}

export interface MonthlyTrendItem {
  month: string;
  reports: number;
}

export interface DepartmentPerformanceItem {
  department: string;
  assigned: number;
  completed: number;
  completionRate: number;
}

export interface OfficerPerformanceItem {
  officer: string;
  assigned: number;
  completed: number;
  completionRate: number;
}

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const response = await authenticatedRequestJson<{ status: string; data: DashboardStats }>('/analytics/dashboard');
  return response.data;
};

export const fetchRecentReports = async (): Promise<RecentReportItem[]> => {
  return authenticatedRequestJson<RecentReportItem[]>('/analytics/recent');
};

export const fetchStatusDistribution = async (): Promise<StatusDistributionItem[]> => {
  return authenticatedRequestJson<StatusDistributionItem[]>('/analytics/status-distribution');
};

export const fetchSeverityDistribution = async (): Promise<SeverityDistributionItem[]> => {
  return authenticatedRequestJson<SeverityDistributionItem[]>('/analytics/severity-distribution');
};

export const fetchReportsByCity = async (): Promise<CityDistributionItem[]> => {
  return authenticatedRequestJson<CityDistributionItem[]>('/analytics/reports-by-city');
};

export const fetchMonthlyTrends = async (): Promise<MonthlyTrendItem[]> => {
  return authenticatedRequestJson<MonthlyTrendItem[]>('/analytics/monthly-trends');
};

export const fetchDepartmentPerformance = async (): Promise<DepartmentPerformanceItem[]> => {
  return authenticatedRequestJson<DepartmentPerformanceItem[]>('/analytics/department-performance');
};

export const fetchOfficerPerformance = async (): Promise<OfficerPerformanceItem[]> => {
  return authenticatedRequestJson<OfficerPerformanceItem[]>('/analytics/officer-performance');
};

export const mapBackendToAnalyticsReport = (report: any): AnalyticsReport => {
  const severityMap: Record<string, MapSeverity> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
    Low: 'Low',
    Medium: 'Medium',
    High: 'High',
    Critical: 'Critical',
  };

  const statusMap: Record<string, 'New' | 'Verified' | 'Assigned' | 'In Progress' | 'Resolved'> = {
    REPORTED: 'New',
    AI_VERIFIED: 'Verified',
    NEEDS_REVIEW: 'Verified',
    OFFICER_ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    FIXED: 'In Progress',
    QUALITY_CHECK: 'In Progress',
    COMPLETED: 'Resolved',
    CLOSED: 'Resolved',
    REJECTED: 'Resolved',
  };

  const verificationMap: Record<string, 'Pending' | 'AI Verified' | 'Officer Verified'> = {
    REPORTED: 'Pending',
    AI_VERIFIED: 'AI Verified',
    NEEDS_REVIEW: 'Officer Verified',
    OFFICER_ASSIGNED: 'Officer Verified',
    IN_PROGRESS: 'Officer Verified',
    FIXED: 'Officer Verified',
    REJECTED: 'Pending',
  };

  const mappedStatus = statusMap[report.status] || 'New';
  const mappedVerification = verificationMap[report.status] || (report.aiResults?.length > 0 ? 'AI Verified' : 'Pending');

  return {
    id: report.id,
    title: report.title || report.address || 'Road Pothole',
    latitude: report.latitude || 0,
    longitude: report.longitude || 0,
    severity: severityMap[report.severity] || 'Medium',
    status: mappedStatus,
    reporter: report.user?.fullName || (report.user?.role === 'USER' ? 'Citizen' : 'Officer'),
    address: report.address || '',
    description: report.description || 'Pothole report',
    createdAt: report.createdAt || report.created_at || new Date().toISOString(),
    updatedAt: report.updatedAt || report.updated_at || new Date().toISOString(),
    image: report.image_url || report.attachments?.[0]?.url || '',
    vehicleType: 'Car',
    verificationStatus: mappedVerification,
    city: report.city || 'Unknown',
    incidentType: report.title?.toLowerCase().includes('crack') ? 'Road Crack' : 'Pothole',
    priority: (report.severity === 'CRITICAL' || report.severity === 'HIGH') ? 'Urgent' : 'Standard',
    estimatedRepairCost: '₹5,000',
    estimatedRepairTime: '24 hrs',
    assignedOfficer: report.officer?.user?.fullName || 'Unassigned',
    department: report.department?.name || 'Roads & Infrastructure',
    citizenReports: 1,
    aiConfidence: report.aiResults?.[0]?.confidenceScore
      ? Math.round(report.aiResults[0].confidenceScore * 100)
      : (report.status === 'AI_VERIFIED' ? 90 : 0),
    detectionMethod: report.status === 'AI_VERIFIED' || (report.aiResults && report.aiResults.length > 0) ? 'AI Automated' : 'Citizen Reported',
    imageTimestamp: report.createdAt || report.created_at || new Date().toISOString(),
    actionHistory: [{ status: mappedStatus, date: report.createdAt || new Date().toISOString() }],
    resolutionHours: 24,
  };
};

export const fetchAnalyticsReports = async (): Promise<AnalyticsReport[]> => {
  try {
    const response = await authenticatedRequestJson<{ status: string; data: any[] }>('/reports?limit=1000');
    const rawReports = Array.isArray(response.data) ? response.data : [];
    return rawReports.map(mapBackendToAnalyticsReport);
  } catch (error) {
    console.error('Failed to fetch analytics reports:', error);
    return [];
  }
};

const severityOrder: Record<string, number> = { Critical: 4, CRITICAL: 4, High: 3, HIGH: 3, Medium: 2, MEDIUM: 2, Low: 1, LOW: 1 };

export const analyticsReports: AnalyticsReport[] = [];

export const defaultAnalyticsFilters: AnalyticsFilters = {
  city: 'All',
  severity: 'All',
  status: 'All',
  dateRange: 'All',
  department: 'All',
  reporter: 'All',
  vehicleType: 'All',
};

export const uniqueValues = (reports: AnalyticsReport[], key: keyof AnalyticsReport): string[] =>
  [...new Set(reports.map((report) => String(report[key])))].filter(Boolean).sort();

export const filterAnalyticsReports = (
  reports: AnalyticsReport[],
  filters: AnalyticsFilters
): AnalyticsReport[] =>
  reports.filter(
    (report) =>
      (filters.city === 'All' || report.city === filters.city) &&
      (filters.severity === 'All' || report.severity.toLowerCase() === filters.severity.toLowerCase()) &&
      (filters.status === 'All' || report.status.toLowerCase() === filters.status.toLowerCase()) &&
      (filters.department === 'All' || report.department === filters.department) &&
      (filters.reporter === 'All' || report.reporter === filters.reporter) &&
      (filters.vehicleType === 'All' || report.vehicleType === filters.vehicleType) &&
      (filters.dateRange === 'All' ||
        Date.parse(report.createdAt) >=
          Date.parse(
            filters.dateRange === '7 days'
              ? new Date(Date.now() - 7 * 86400000).toISOString()
              : new Date(Date.now() - 30 * 86400000).toISOString()
          ))
  );

export const countBy = <K extends keyof AnalyticsReport>(
  reports: AnalyticsReport[],
  key: K
): NamedValue[] =>
  Object.entries(
    reports.reduce<Record<string, number>>((result, report) => {
      const value = String(report[key] ?? 'Unknown');
      result[value] = (result[value] ?? 0) + 1;
      return result;
    }, {})
  ).map(([label, value]) => ({ label, value }));

export const highestSeverityFirst = (reports: AnalyticsReport[]) =>
  [...reports].sort(
    (first, second) =>
      (severityOrder[second.severity] ?? 0) - (severityOrder[first.severity] ?? 0) ||
      Date.parse(second.createdAt) - Date.parse(first.createdAt)
  );
