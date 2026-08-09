// Shared contracts for the future pothole reporting API.
export type RoadType = 'Highway' | 'Main Road' | 'Street' | 'Village Road' | 'Bridge';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type Traffic = 'Low' | 'Medium' | 'Heavy';
export interface Location { latitude: string; longitude: string; roadName: string; area: string; city: string; landmark: string; }
export interface AIResult { confidence: string; severity: Severity; damageType: string; priority: string; }
export interface ReportRequest { image: string | null; location: Location; description: string; roadType: RoadType | ''; severity: Severity | ''; traffic: Traffic | ''; notes: string; aiResult?: AIResult; }
