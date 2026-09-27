import type { ReportRequest } from '../../types/Report';

export const ReviewCard = ({ report }: { report: ReportRequest }) => <div className="report-card review-card">
  {report.imagePreview && <img src={report.imagePreview} alt="Reported pothole" />}
  <h2>Review your report</h2>
  <p><strong>Location:</strong> {[report.location.roadName, report.location.area, report.location.landmark, report.location.city, report.location.state].filter(Boolean).join(', ')}</p>
  <p><strong>Description:</strong> {report.description}</p>
  <p><strong>Severity:</strong> {report.severity}</p>
  <p><strong>Road type:</strong> {report.roadType}</p>
  <p><strong>AI analysis:</strong> Starts automatically after submission. The real result will appear in Report Details.</p>
</div>;
