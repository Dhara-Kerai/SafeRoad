// Shared contracts for the future pothole reporting API.
export type RoadType = 'Highway' | 'Main Road' | 'Street' | 'Village Road' | 'Bridge';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type Traffic = 'Low' | 'Medium' | 'Heavy';
export interface Location { latitude: string; longitude: string; roadName: string; area: string; state?: string; city: string; landmark: string; }
export interface AIResult {
  id?: string;
  reportId?: string;
  potholeDetected?: boolean;
  confidence?: string | number;
  confidenceScore?: number;
  severity?: Severity | string;
  damageType?: string;
  priority?: string;
  details?: string | Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface ReportRequest { image: string | null; location: Location; description: string; roadType: RoadType | ''; severity: Severity | ''; traffic: Traffic | ''; notes: string; aiResult?: AIResult; }
