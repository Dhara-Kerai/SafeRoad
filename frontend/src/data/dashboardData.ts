// Static presentation data used by the dashboard until live services are connected.
import type { IconType } from 'react-icons';
import {
  FiAlertCircle,
  FiBarChart2,
  FiClock,
  FiMapPin,
  FiPlus,
  FiRadio,
  FiShield,
  FiTool,
} from 'react-icons/fi';

export interface QuickAction {
  label: string;
  icon: IconType;
  path?: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  icon: IconType;
  color: 'blue' | 'amber' | 'green' | 'red';
}

export interface RecentReport {
  place: string;
  status: 'Critical' | 'High' | 'Under repair' | 'Verified';
  age: string;
}

export interface TimelineEvent {
  color: 'blue' | 'amber' | 'green';
  title: string;
  description: string;
}

export const quickActions: QuickAction[] = [
  { label: 'Report Pothole', icon: FiPlus, path: '/report-pothole' },
  { label: 'Open Live Map', icon: FiMapPin, path: '/live-map' },
  { label: 'Run AI Detection', icon: FiRadio, path: '/ai-detection' },
  { label: 'Create Complaint', icon: FiTool, path: '/report-pothole' },
];

export const dashboardMetrics: DashboardMetric[] = [
  { label: 'Total Reports', value: '12,846', change: '+12.5%', icon: FiBarChart2, color: 'blue' },
  { label: 'Pending Verification', value: '248', change: '-8.2%', icon: FiClock, color: 'amber' },
  { label: 'AI Verified', value: '9,402', change: '+18.4%', icon: FiShield, color: 'green' },
  { label: 'Critical Potholes', value: '43', change: '+4 today', icon: FiAlertCircle, color: 'red' },
];

export const recentReports: RecentReport[] = [
  { place: 'Ring Road, Sector 18', status: 'Critical', age: '12 min ago' },
  { place: 'MG Road, Near Metro', status: 'High', age: '38 min ago' },
  { place: 'NH-48, Mile 36', status: 'Under repair', age: '1 hr ago' },
  { place: 'Rajpath, Gate 2', status: 'Verified', age: '2 hrs ago' },
];

export const weeklyReportActivity = [42, 63, 51, 82, 68, 94, 74];
export const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const timelineEvents: TimelineEvent[] = [
  {
    color: 'blue',
    title: 'AI verification completed',
    description: 'Ring Road report classified as critical · 12 min ago',
  },
  {
    color: 'amber',
    title: 'Repair team assigned',
    description: 'Work order #WR-2942 assigned to North Zone · 38 min ago',
  },
  {
    color: 'green',
    title: 'Road reopened',
    description: 'Repair at NH-48 marked completed · 1 hr ago',
  },
];
