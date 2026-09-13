import {
  authenticatedRequestJson,
  redirectToLogin,
  refreshAccessToken,
} from './authService';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');

const requestJson = authenticatedRequestJson;

const requestFormData = async <T>(path: string, formData: FormData): Promise<T> => {
  const makeRequest = () => fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  let response = await makeRequest();
  if (response.status === 401) {
    if (await refreshAccessToken()) {
      response = await makeRequest();
    } else {
      redirectToLogin();
    }
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.detail ?? payload?.message ?? 'Request failed');
  }

  return payload as T;
};

import type { ReportRequest, Severity } from '../types/Report';
import type { ManagedReport, ReportComment, ReportStatus } from '../types/reportManagement';

export const getServerUrl = (url: string | null) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');
  const origin = baseUrl.replace(/\/api$/, '');
  return `${origin}${url}`;
};

export const mapBackendSeverityToFrontend = (severity: string): Severity => {
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

export const mapBackendStatusToFrontend = (status: string): ReportStatus => {
  if (!status) return 'Reported';
  switch (status.toUpperCase()) {
    case 'REPORTED':
      return 'Reported';
    case 'AI_VERIFIED':
      return 'AI Verified';
    case 'OFFICER_VERIFIED':
    case 'ACKNOWLEDGED':
      return 'Officer Verified';
    case 'NEEDS_REVIEW':
      return 'Needs Review';
    case 'ASSIGNED':
    case 'OFFICER_ASSIGNED':
      return 'Repair Assigned';
    case 'IN_PROGRESS':
      return 'Under Repair';
    case 'FIXED':
      return 'Fixed';
    case 'QUALITY_CHECK':
      return 'Quality Check';
    case 'RESOLVED':
    case 'COMPLETED':
      return 'Completed';
    case 'CLOSED':
      return 'Closed';
    case 'REJECTED':
      return 'Rejected';
    default:
      return 'Reported';
  }
};

export const mapBackendReportToManagedReport = (report: any): ManagedReport => {
  const severity = mapBackendSeverityToFrontend(report.severity || 'MEDIUM');
  const status = mapBackendStatusToFrontend(report.status || 'REPORTED');

  let formattedDate = '';
  try {
    const createdAt = report.created_at || report.createdAt;
    const d = new Date(createdAt);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    formattedDate = `${day} ${month} ${year}, ${strTime}`;
  } catch (e) {
    formattedDate = report.created_at || report.createdAt || 'Just now';
  }

  const priority = (severity === 'Critical' || severity === 'High') ? 'Urgent' : 'Standard';
  const aiResult = (Array.isArray(report.aiResults) && report.aiResults.length > 0)
    ? report.aiResults[0]
    : (Array.isArray(report.ai_results) && report.ai_results.length > 0)
    ? report.ai_results[0]
    : (report.aiResult && !Array.isArray(report.aiResult) ? report.aiResult : null);
  const aiVerified = Boolean(aiResult?.potholeDetected);
  const aiConfidence = aiResult ? aiResult.confidenceScore : undefined;

  let aiDetails: Record<string, unknown> | null = null;
  let aiSeverity: string | undefined;
  if (aiResult && aiResult.details) {
    try {
      aiDetails = typeof aiResult.details === 'string' ? JSON.parse(aiResult.details) : aiResult.details;
      aiSeverity = typeof aiDetails?.primarySeverity === 'string' ? aiDetails.primarySeverity : undefined;
    } catch (e) {
      console.warn('Failed to parse AIResult details:', e);
    }
  }

  const normalizedAiResult = aiResult ? {
    id: aiResult.id,
    reportId: aiResult.reportId || report.id,
    potholeDetected: Boolean(aiResult.potholeDetected),
    confidence: typeof aiResult.confidenceScore === 'number'
      ? `${Math.round(aiResult.confidenceScore * 100)}%`
      : aiResult.confidenceScore,
    confidenceScore: typeof aiResult.confidenceScore === 'number' ? aiResult.confidenceScore : undefined,
    severity: aiSeverity || (aiResult.severity ? mapBackendSeverityToFrontend(aiResult.severity) : undefined),
    damageType: typeof aiDetails?.detections === 'object' && Array.isArray(aiDetails.detections) && aiDetails.detections[0]
      ? String((aiDetails.detections[0] as Record<string, unknown>).className || 'Not available')
      : undefined,
    priority: (aiSeverity || aiResult.severity || report.severity || '').toLowerCase().includes('critical') || (aiSeverity || aiResult.severity || report.severity || '').toLowerCase().includes('high') ? 'Urgent' : 'Standard',
    details: aiDetails,
    createdAt: aiResult.createdAt || report.created_at || report.createdAt,
  } : null;

  const imageUrl = report.image_url || report.attachments?.[0]?.url || null;

  const reporterName = report.user?.fullName || null;
  const reporterEmail = report.user?.email || null;
  const assignedOfficerName = report.officer?.user?.fullName || null;
  const assignedOfficerBadge = report.officer?.badgeNumber || null;
  const assignedOfficerDepartment = report.officer?.department?.name || null;
  const officerId = report.officerId || report.officer?.id || null;

  return {
    id: report.id,
    date: formattedDate,
    location: report.address || report.title || 'Unknown Location',
    description: report.description,
    roadType: 'Main Road',
    severity: severity,
    traffic: 'Medium',
    status: status,
    aiVerified: aiVerified,
    priority: priority,
    imageLabel: imageUrl ? 'Pothole Image' : 'No image',
    image_url: imageUrl,
    aiConfidence,
    aiSeverity,
    aiResult: normalizedAiResult,
    aiDetails,
    totalDetections: typeof aiDetails?.totalDetections === 'number' ? aiDetails.totalDetections : 0,
    reporterName,
    reporterEmail,
    assignedOfficerName,
    assignedOfficerBadge,
    assignedOfficerDepartment,
    officerId,
    latitude: report.latitude,
    longitude: report.longitude,
  };
};

export const mapBackendCommentToReportComment = (comment: any): ReportComment => {
  let formattedTime = '';
  try {
    const createdAt = comment.created_at || comment.createdAt;
    const d = new Date(createdAt);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    formattedTime = `${day} ${month}, ${hours}:${minutes}`;
  } catch (e) {
    formattedTime = 'Just now';
  }

  const authorName = comment.user?.fullName || comment.author || (comment.user_id ? `User #${comment.user_id}` : 'User');
  const roleName = comment.user?.role === 'OFFICER' || comment.user?.role === 'ADMIN' ? 'Officer' : 'Citizen';
  const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return {
    id: comment.id,
    author: authorName,
    role: roleName,
    message: comment.comment || comment.content || '',
    timestamp: formattedTime,
    initials,
  };
};

const mapStatusToBackend = (status: string): string | undefined => {
  if (!status || status === 'All') return undefined;
  switch (status) {
    case 'Reported':
      return 'REPORTED';
    case 'AI Verified':
      return 'AI_VERIFIED';
    case 'Officer Verified':
      return 'OFFICER_ASSIGNED';
    case 'Repair Assigned':
      return 'OFFICER_ASSIGNED';
    case 'Under Repair':
      return 'IN_PROGRESS';
    case 'Fixed':
      return 'FIXED';
    case 'Quality Check':
      return 'QUALITY_CHECK';
    case 'Completed':
      return 'COMPLETED';
    case 'Closed':
      return 'CLOSED';
    case 'Needs Review':
      return 'NEEDS_REVIEW';
    case 'Rejected':
      return 'REJECTED';
    default:
      return status.toUpperCase().replace(' ', '_');
  }
};

export interface GetReportsParams {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  severity?: string;
  sort_by?: string;
}

export const getReports = async (params: GetReportsParams = {}, mine = false) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.size) query.append('limit', String(params.size));
  if (params.search) query.append('search', params.search);
  
  if (params.status && params.status !== 'All') {
    const backendStatus = mapStatusToBackend(params.status);
    if (backendStatus) query.append('status', backendStatus);
  }
  
  if (params.severity && params.severity !== 'All') {
    query.append('severity', params.severity.toUpperCase());
  }
  
  if (params.sort_by) {
    query.append('sort_by', params.sort_by);
  }
  if (mine) query.append('mine', 'true');

  const path = `/reports?${query.toString()}`;
  
  const response = await requestJson<any>(path, {
    method: 'GET',
  });

  const rawItems = response.items || response.data || [];
  return {
    items: rawItems.map(mapBackendReportToManagedReport),
    total: response.total ?? response.pagination?.total ?? rawItems.length,
    page: response.page ?? response.pagination?.page ?? 1,
    size: response.size ?? response.pagination?.limit ?? rawItems.length,
  };
};

export const getMyReports = (params: GetReportsParams = {}) => getReports(params, true);

export const searchReports = async (query: string, limit = 5) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [] as Array<{
      id: string;
      title: string;
      description?: string | null;
      status?: string | null;
      severity?: string | null;
      address?: string | null;
      city?: string | null;
      reporter_name?: string | null;
      assigned_officer_name?: string | null;
      image_url?: string | null;
    }>;
  }

  const response = await requestJson<any>(`/reports/search?q=${encodeURIComponent(trimmedQuery)}&limit=${limit}`, {
    method: 'GET',
  });

  return (response?.data ?? response ?? []) as Array<{
    id: string;
    title: string;
    description?: string | null;
    status?: string | null;
    severity?: string | null;
    address?: string | null;
    city?: string | null;
    reporter_name?: string | null;
    assigned_officer_name?: string | null;
    image_url?: string | null;
  }>;
};

export const getAssignedReports = async (params: GetReportsParams = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.size) query.append('limit', String(params.size));
  if (params.search) query.append('search', params.search);
  if (params.status && params.status !== 'All') query.append('status', mapStatusToBackend(params.status) || '');
  if (params.severity && params.severity !== 'All') query.append('severity', params.severity.toUpperCase());
  const response = await requestJson<any>(`/reports/assigned?${query.toString()}`, { method: 'GET' });
  const rawItems = response.items || response.data || [];
  return { items: rawItems.map(mapBackendReportToManagedReport), total: response.total ?? response.pagination?.total ?? rawItems.length, page: response.pagination?.page ?? 1, size: response.pagination?.limit ?? rawItems.length };
};

export const getOfficerWorkload = () => requestJson<any>('/reports/officer/workload', { method: 'GET' });

export const updateOfficerReportStatus = (reportId: string, status: 'IN_PROGRESS' | 'FIXED', remarks?: string) => requestJson<any>(`/reports/${reportId}/officer-status`, {
  method: 'PATCH',
  body: JSON.stringify({ status, remarks }),
});

export const getReportById = async (reportId: string): Promise<ManagedReport> => {
  const response = await requestJson<any>(`/reports/${reportId}`, {
    method: 'GET',
  });
  const reportData = response?.data?.report || response;
  return mapBackendReportToManagedReport(reportData);
};


export const listComments = async (reportId: string): Promise<ReportComment[]> => {
  const comments = await requestJson<any[]>(`/reports/${reportId}/comments`, {
    method: 'GET',
  });
  return comments.map(mapBackendCommentToReportComment);
};

export const addComment = async (reportId: string, comment: string): Promise<ReportComment> => {
  const newComment = await requestJson<any>(`/reports/${reportId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
  return mapBackendCommentToReportComment(newComment);
};

export const updateReportStatus = async (reportId: string, status: string, remarks?: string) => {
  const backendStatus = status.toUpperCase().replace(' ', '_');
  const response = await requestJson<any>(`/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: backendStatus, remarks }),
  });
  return { success: true, status: response.status };
};

export const assignOfficerToReport = async (reportId: string, officerId: string) => {
  const response = await requestJson<any>(`/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({ officerId, status: 'OFFICER_ASSIGNED' }),
  });
  return { success: true, data: response };
};

export const verifyReport = async (reportId: string, remarks?: string) => {
  const response = await requestJson<any>(`/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'AI_VERIFIED', remarks }),
  });
  return { success: true, status: response.status };
};

export const submitReport = async (report: ReportRequest) => {
  const addressParts = [
    report.location.roadName,
    report.location.area,
    report.location.landmark,
    report.location.city,
    report.location.state,
  ].filter(Boolean);

  const latitude = Number(report.location.latitude);
  const longitude = Number(report.location.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('A valid report location is required.');
  }

  return requestJson<{ id: string }>('/reports', {
    method: 'POST',
    body: JSON.stringify({
      title: report.location.roadName || 'Pothole report',
      description: report.description,
      severity: (report.severity || 'Medium').toUpperCase(),
      latitude,
      longitude,
      address: addressParts.join(', '),
      city: report.location.city || 'Unknown',
      imageUrl: report.image,
    }),
  });
};

export const uploadImage = async (image: File) => {
  const formData = new FormData();
  formData.append('file', image);
  const response = await requestFormData<{ image_url: string }>('/reports/upload', formData);
  return response.image_url;
};

export interface BackendMapReport {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  severity: string;
  status: string;
  createdAt: string;
  address?: string | null;
  city?: string | null;
  description?: string | null;
  user?: { fullName: string } | null;
  department?: { name: string } | null;
  officer?: { user?: { fullName: string } } | null;
  attachments?: Array<{ url: string }> | null;
  aiResults?: Array<{ confidenceScore: number; potholeDetected: boolean }> | null;
}

export const getBackendMapReports = async (): Promise<BackendMapReport[]> => {
  const response = await requestJson<any>('/reports/map', {
    method: 'GET',
  });
  return response?.data || response || [];
};

export interface GeoLocationResult {
  status: 'success' | 'denied' | 'unsupported' | 'unavailable';
  latitude?: number;
  longitude?: number;
  message?: string;
}

export const getLocation = async (): Promise<GeoLocationResult> => {
  if (!navigator.geolocation) {
    return {
      status: 'unsupported',
      message: 'This browser does not support geolocation. You can still continue with the report form manually.',
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        status: 'success',
        latitude: coords.latitude,
        longitude: coords.longitude,
        message: 'Location detected successfully.',
      }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({
            status: 'denied',
            message: 'Location access was denied. You can retry anytime to auto-fill the coordinates.',
          });
          return;
        }

        resolve({
          status: 'unavailable',
          message: 'Location could not be detected right now. Please try again.',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  });
};
