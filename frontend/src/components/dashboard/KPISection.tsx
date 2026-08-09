import { FiAlertCircle, FiBarChart2, FiClock, FiShield } from 'react-icons/fi';

export interface KPISectionProps {
  stats?: {
    totalReports: number;
    resolvedReports: number;
    pendingReports: number;
    inProgressReports: number;
    highSeverity: number;
    aiVerifiedReports?: number;
  } | null;
  isLoading?: boolean;
}

export const KPISection = ({ stats, isLoading }: KPISectionProps) => {
  const metrics = [
    {
      label: 'Total Reports',
      value: isLoading ? '...' : (stats?.totalReports ?? 0).toLocaleString(),
      change: 'Real-time',
      icon: FiBarChart2,
      color: 'blue' as const,
    },
    {
      label: 'Pending Verification',
      value: isLoading ? '...' : (stats?.pendingReports ?? 0).toLocaleString(),
      change: 'Action needed',
      icon: FiClock,
      color: 'amber' as const,
    },
    {
      label: 'AI Verified',
      value: isLoading ? '...' : ((stats?.aiVerifiedReports ?? stats?.resolvedReports) ?? 0).toLocaleString(),
      change: 'Verified',
      icon: FiShield,
      color: 'green' as const,
    },
    {
      label: 'Critical Potholes',
      value: isLoading ? '...' : (stats?.highSeverity ?? 0).toLocaleString(),
      change: 'High priority',
      icon: FiAlertCircle,
      color: 'red' as const,
    },
  ];

  return (
    <section className="kpi-grid" aria-label="Road safety metrics">
      {metrics.map(({ label, value, change, icon: Icon, color }) => (
        <article key={label} className={`kpi-card kpi-card--${color}`}>
          <div>
            <p>{label}</p>
            <strong>{value}</strong>
            <small>{change}</small>
          </div>
          <span className="kpi-icon"><Icon /></span>
          <i />
        </article>
      ))}
    </section>
  );
};
