// Vertical status timeline for a report's repair lifecycle.
import type { ReportStatus } from '../../types/reportManagement';
const stages: ReportStatus[] = ['Reported', 'AI Verified', 'Repair Assigned', 'Under Repair', 'Fixed', 'Quality Check', 'Completed', 'Closed'];

export const ReportTimeline = ({ status }: { status: ReportStatus }) => {
  const currentIndex = stages.indexOf(status);

  if (status === 'Needs Review' || status === 'Rejected') {
    return <ol className="report-timeline"><li className="is-complete"><i />Reported</li><li className={status === 'Needs Review' ? 'is-complete' : ''}><i />Needs Review</li>{status === 'Rejected' ? <li className="is-complete"><i />Rejected</li> : null}</ol>;
  }

  return <ol className="report-timeline">{stages.map((stage, index) => <li key={stage} className={index <= currentIndex ? 'is-complete' : ''}><i />{stage}</li>)}</ol>;
};
