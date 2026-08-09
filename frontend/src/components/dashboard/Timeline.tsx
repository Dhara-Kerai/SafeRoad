import type { RecentReportItem } from '../../services/analyticsService';

export interface TimelineProps {
  reports?: RecentReportItem[];
  isLoading?: boolean;
}

interface TimelineEvent {
  id: string;
  color: 'blue' | 'amber' | 'green';
  title: string;
  description: string;
}

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

const mapReportToTimelineEvent = (report: RecentReportItem): TimelineEvent => {
  const ageStr = formatAge(report.createdAt);
  const place = report.title || report.city || 'Report';

  switch (report.status.toUpperCase()) {
    case 'AI_VERIFIED':
      return {
        id: report.id,
        color: 'blue',
        title: 'AI Verification Completed',
        description: `${place} classified and verified by AI · ${ageStr}`,
      };
    case 'IN_PROGRESS':
    case 'OFFICER_ASSIGNED':
      return {
        id: report.id,
        color: 'amber',
        title: 'Repair Team Assigned',
        description: `Work order active for ${place} · ${ageStr}`,
      };
    case 'FIXED':
    case 'RESOLVED':
      return {
        id: report.id,
        color: 'green',
        title: 'Road Repair Completed',
        description: `Repair completed at ${place} · ${ageStr}`,
      };
    default:
      return {
        id: report.id,
        color: 'blue',
        title: 'New Pothole Report',
        description: `${place} logged in system · ${ageStr}`,
      };
  }
};

export const Timeline = ({ reports = [], isLoading }: TimelineProps) => {
  const events = reports.slice(0, 4).map(mapReportToTimelineEvent);

  return (
    <article className="panel activity-panel">
      <header>
        <div>
          <h2>Activity timeline</h2>
          <p>Latest operational events</p>
        </div>
      </header>
      <div className="timeline">
        {isLoading ? (
          <p style={{ padding: '0.5rem 0', color: '#6b7280' }}>Loading activity timeline...</p>
        ) : events.length === 0 ? (
          <p style={{ padding: '0.5rem 0', color: '#6b7280' }}>No recent activity events.</p>
        ) : (
          events.map(({ id, color, title, description }) => (
            <p key={id}>
              <i className={`timeline-dot timeline-dot--${color}`} />
              <strong>{title}</strong>
              <span>{description}</span>
            </p>
          ))
        )}
      </div>
    </article>
  );
};

