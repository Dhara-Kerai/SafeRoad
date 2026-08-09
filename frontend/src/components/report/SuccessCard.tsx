import { Link } from 'react-router-dom';

export const SuccessCard = ({ reportId }: { reportId?: string }) => (
  <section className="report-card success-card">
    <div className="success-mark">✓</div>
    <h1>Report Submitted Successfully</h1>
    {reportId ? <strong>Report #{reportId.slice(0, 8)}</strong> : null}
    <p>Your report has been submitted. Municipal authorities will review it shortly.</p>
    <Link className="button-primary" to="/dashboard">Back to Dashboard</Link>
  </section>
);
