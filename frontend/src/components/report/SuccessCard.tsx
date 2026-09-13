import { Link } from 'react-router-dom';

export const SuccessCard = ({ reportId }: { reportId?: string }) => (
  <section className="report-card success-card">
    <div className="success-mark">✓</div>
    <h1>Report Submitted Successfully</h1>
    {reportId ? <strong>Report #{reportId.slice(0, 8)}</strong> : null}
    <p>Your report has been submitted. Municipal authorities and AI verification will process it shortly.</p>
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
      {reportId && (
        <Link className="button-primary" to={`/report/${reportId}`}>
          Track Report
        </Link>
      )}
      <Link className={reportId ? 'button-secondary' : 'button-primary'} to="/dashboard">
        Back to Dashboard
      </Link>
    </div>
  </section>
);
