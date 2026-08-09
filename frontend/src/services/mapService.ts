import { getBackendMapReports, getServerUrl, type BackendMapReport } from './reportService';
import type { MapReport, MapSeverity, MapStatus } from '../types/map';

export const mapBackendMapReportToMapReport = (r: BackendMapReport): MapReport => {
  const severity = mapSeverity(r.severity);
  const status = mapStatus(r.status);
  const dateStr = r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString();
  const imageUrl = r.attachments?.[0]?.url || null;
  const aiResult = r.aiResults?.[0];
  const confidence = aiResult?.confidenceScore !== undefined ? Math.round(aiResult.confidenceScore * 100) : 0;

  return {
    id: r.id,
    title: r.title || 'Pothole Report',
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    severity,
    status,
    reporter: r.user?.fullName || 'Citizen User',
    address: r.address || r.city || 'India',
    description: r.description || r.title || 'Road incident report',
    createdAt: dateStr,
    updatedAt: dateStr,
    image: imageUrl ? getServerUrl(imageUrl) : 'No evidence image uploaded',
    vehicleType: 'Car',
    verificationStatus: r.status === 'REPORTED' ? 'Pending' : (aiResult?.potholeDetected ? 'AI Verified' : 'Officer Verified'),
    city: r.city || 'Unknown',
    incidentType: 'Pothole',
    priority: severity === 'Critical' ? 'Urgent' : severity === 'High' ? 'Priority' : 'Standard',
    estimatedRepairCost: severity === 'Critical' ? '₹15,000' : severity === 'High' ? '₹10,000' : '₹5,000',
    estimatedRepairTime: severity === 'Critical' ? '4–8 hours' : '1–2 days',
    assignedOfficer: r.officer?.user?.fullName || 'Unassigned',
    department: r.department?.name || 'Road Maintenance',
    citizenReports: 1,
    aiConfidence: confidence,
    detectionMethod: aiResult ? 'AI Automated Scan' : 'Citizen mobile report',
    imageTimestamp: dateStr,
    actionHistory: [{ status: 'Reported', date: dateStr }],
  };
};

const mapSeverity = (severity?: string): MapSeverity => {
  if (!severity) return 'Medium';
  switch (severity.toUpperCase()) {
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Medium';
    case 'HIGH':
      return 'High';
    case 'CRITICAL':
      return 'Critical';
    default:
      return 'Medium';
  }
};

const mapStatus = (status?: string): MapStatus => {
  if (!status) return 'New';
  switch (status.toUpperCase()) {
    case 'REPORTED':
      return 'New';
    case 'AI_VERIFIED':
    case 'NEEDS_REVIEW':
      return 'Verified';
    case 'OFFICER_ASSIGNED':
    case 'ASSIGNED':
      return 'Assigned';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'FIXED':
    case 'RESOLVED':
      return 'Resolved';
    default:
      return 'New';
  }
};

export const getMapReports = async (): Promise<MapReport[]> => {
  const backendReports = await getBackendMapReports();
  return backendReports.map(mapBackendMapReportToMapReport);
};

export const getLatestReports = (reports: MapReport[], limit = 6): MapReport[] =>
  [...reports]
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .slice(0, limit);

export const formatReportDate = (date: string): string =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

