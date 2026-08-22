import { getBackendMapReports, getServerUrl, type BackendMapReport } from './reportService';
import type { MapReport, MapSeverity, MapStatus } from '../types/map';

export const mapBackendMapReportToMapReport = (report: BackendMapReport): MapReport => {
  const date = report.createdAt;
  const aiResult = report.aiResults?.[0];

  return {
    id: report.id,
    title: report.title,
    latitude: Number(report.latitude),
    longitude: Number(report.longitude),
    severity: mapSeverity(report.severity),
    status: mapStatus(report.status),
    reporter: report.user?.fullName || '',
    address: report.address || report.city || '',
    description: report.description || '',
    createdAt: report.createdAt,
    updatedAt: date,
    imageUrl: report.attachments?.[0]?.url ? getServerUrl(report.attachments[0].url) : null,
    image: report.attachments?.[0]?.url ? getServerUrl(report.attachments[0].url) : '',
    vehicleType: '',
    verificationStatus: report.status === 'REPORTED' ? 'Pending' : (aiResult?.potholeDetected ? 'AI Verified' : 'Officer Verified'),
    city: report.city || '',
    incidentType: 'Pothole',
    priority: report.severity === 'CRITICAL' ? 'Urgent' : report.severity === 'HIGH' ? 'Priority' : 'Standard',
    estimatedRepairCost: '',
    estimatedRepairTime: '',
    assignedOfficer: report.officer?.user?.fullName || null,
    department: report.department?.name || null,
    citizenReports: 0,
    aiConfidence: aiResult?.confidenceScore !== undefined ? Math.round(aiResult.confidenceScore * 100) : 0,
    detectionMethod: '',
    imageTimestamp: date,
    actionHistory: [],
  };
};

const mapSeverity = (severity?: string): MapSeverity => {
  switch (severity?.toUpperCase()) {
    case 'LOW': return 'Low';
    case 'HIGH': return 'High';
    case 'CRITICAL': return 'Critical';
    case 'MEDIUM':
    default: return 'Medium';
  }
};

const mapStatus = (status?: string): MapStatus => {
  switch (status?.toUpperCase()) {
    case 'AI_VERIFIED': return 'AI Verified';
    case 'NEEDS_REVIEW': return 'Needs Review';
    case 'OFFICER_ASSIGNED': return 'Officer Assigned';
    case 'IN_PROGRESS': return 'In Progress';
    case 'FIXED': return 'Fixed';
    case 'QUALITY_CHECK': return 'Quality Check';
    case 'COMPLETED': return 'Completed';
    case 'CLOSED': return 'Closed';
    case 'REJECTED': return 'Rejected';
    case 'REPORTED':
    default: return 'Reported';
  }
};

const hasValidCoordinates = (report: MapReport): boolean =>
  Number.isFinite(report.latitude) && Number.isFinite(report.longitude)
  && report.latitude >= -90 && report.latitude <= 90
  && report.longitude >= -180 && report.longitude <= 180;

export const getMapReports = async (): Promise<MapReport[]> =>
  (await getBackendMapReports()).map(mapBackendMapReportToMapReport).filter(hasValidCoordinates);

export const getLatestReports = (reports: MapReport[], limit = 6): MapReport[] =>
  [...reports].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)).slice(0, limit);

export const formatReportDate = (date: string): string =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
