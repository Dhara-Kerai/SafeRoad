import { useNavigate } from 'react-router-dom';
import type { RecentReportItem } from '../../services/analyticsService';

export interface RecentReportsProps {
  reports?: RecentReportItem[];
  isLoading?: boolean;
}

const statusClassName = (status: string) => {
  const normalized = status.toLowerCase().replace(/_/g, '-');
  if (normalized.includes('closed') || normalized.includes('resolved') || normalized.includes('completed')) return 'verified';
  if (normalized.includes('progress') || normalized.includes('repair') || normalized.includes('assigned')) return 'under-repair';
  if (normalized.includes('critical') || normalized.includes('high')) return 'critical';
  return 'reported';
};

const formatStatusLabel = (status: string) => {
  switch (status.toUpperCase()) {
    case 'REPORTED':
      return 'Reported';
    case 'AI_VERIFIED':
      return 'AI Verified';
    case 'NEEDS_REVIEW':
      return 'Needs Review';
    case 'OFFICER_ASSIGNED':
      return 'Assigned';
    case 'IN_PROGRESS':
      return 'Under Repair';
    case 'FIXED':
      return 'Fixed — awaiting quality check';
    case 'QUALITY_CHECK':
      return 'Quality Check';
    case 'COMPLETED':
      return 'Completed';
    case 'CLOSED':
      return 'Closed';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
};

const formatAge = (createdAt: string) => {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (isNaN(diffMins) || diffMins < 0) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export const RecentReports = ({ reports = [], isLoading }: RecentReportsProps) => {
  const navigate = useNavigate();

  return (
    <aside className="panel recent-panel">
      <header>
        <div>
          <h2>Recent reports</h2>
          <p>Latest field activity</p>
        </div>
        <button type="button" className="text-button" onClick={() => navigate('/my-reports')}>
          View all
        </button>
      </header>
      <div className="report-list">
        {isLoading ? (
          <p className="loading-text" style={{ padding: '1rem', color: '#6b7280' }}>
            Loading recent reports...
          </p>
        ) : reports.length === 0 ? (
          <p className="empty-text" style={{ padding: '1rem', color: '#6b7280' }}>
            No recent reports found.
          </p>
        ) : (
          reports.map((report) => {
            const statusClass = statusClassName(report.status);
            const displayTitle = report.title || report.city || 'Report';
            return (
              <article
                className="report-item"
                key={report.id}
                onClick={() => navigate(`/report/${report.id}`)}
                tabIndex={0}
                role="button"
                aria-label={`View report for ${displayTitle}`}
                style={{ cursor: 'pointer' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/report/${report.id}`);
                  }
                }}
              >
                <span className={`report-dot report-dot--${statusClass}`} />
                <div>
                  <strong>{displayTitle}</strong>
                  <small>{formatAge(report.createdAt)}</small>
                </div>
                <b className={`status status--${statusClass}`}>{formatStatusLabel(report.status)}</b>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
};
