// Types for static citizen report-management presentation data.
import type { AIResult, Severity } from './Report';
export type ReportStatus = 'Reported' | 'AI Verified' | 'Officer Verified' | 'Repair Assigned' | 'Under Repair' | 'Fixed' | 'Quality Check' | 'Completed' | 'Closed' | 'Needs Review' | 'Rejected';
export interface ManagedReport {
  id: string;
  date: string;
  location: string;
  description: string;
  roadType: string;
  severity: Severity;
  traffic: string;
  status: ReportStatus;
  aiVerified: boolean;
  priority: string;
  imageLabel: string;
  image_url?: string | null;
  aiConfidence?: number | null;
  aiSeverity?: string | null;
  aiResult?: AIResult | null;
  aiDetails?: Record<string, unknown> | null;
  totalDetections?: number;
  reporterName?: string | null;
  reporterEmail?: string | null;
  assignedOfficerName?: string | null;
  assignedOfficerBadge?: string | null;
  assignedOfficerDepartment?: string | null;
  officerId?: string | null;
  latitude?: number;
  longitude?: number;
}
export interface ReportComment { id?: string; author: string; role: string; message: string; timestamp: string; initials: string; }
