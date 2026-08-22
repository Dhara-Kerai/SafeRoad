import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiClipboard, FiClock, FiMapPin, FiTool } from 'react-icons/fi';
import { SeverityBadge, StatusBadge } from '../../components/reportManagement/ReportBadges';
import { useAuth } from '../../context/AuthContext';
import { getOfficerWorkload, getServerUrl, mapBackendReportToManagedReport } from '../../services/reportService';
import type { ManagedReport } from '../../types/reportManagement';
import './OfficerDashboard.css';

interface OfficerStats { totalAssignedReports: number; pendingReports: number; inRepair: number; fixedReports: number; recentAssignments: unknown[]; }

export const OfficerDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<OfficerStats | null>(null);
  const [reports, setReports] = useState<ManagedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { void getOfficerWorkload().then((response) => { setStats(response.data); setReports((response.data.recentAssignments ?? []).map(mapBackendReportToManagedReport)); }).catch((err: Error) => setError(err.message || 'Unable to load officer dashboard.')).finally(() => setLoading(false)); }, []);
  const cards = useMemo(() => [
    { label: 'Total assigned', value: stats?.totalAssignedReports ?? 0, Icon: FiClipboard },
    { label: 'Pending', value: stats?.pendingReports ?? 0, Icon: FiClock },
    { label: 'In repair', value: stats?.inRepair ?? 0, Icon: FiTool },
    { label: 'Fixed', value: stats?.fixedReports ?? 0, Icon: FiCheckCircle },
  ], [stats]);
  if (loading) return <main className="officer-dashboard"><p className="officer-dashboard__state">Loading assigned work…</p></main>;
  return <main className="officer-dashboard">
    <header className="officer-dashboard__header"><p className="eyebrow">OPERATIONS</p><h1>Officer Dashboard</h1><p>Welcome, {currentUser?.name || 'Officer'}. Manage your assigned road-safety work.</p></header>
    {error && <div className="officer-dashboard__state officer-dashboard__state--error">{error}</div>}
    <section className="officer-kpis" aria-label="Officer workload summary">{cards.map(({ label, value, Icon }) => <article key={label}><div><span>{label}</span><Icon size={16} /></div><strong>{value}</strong></article>)}</section>
    <section className="officer-assignments">
      <div className="officer-assignments__header"><div><h2>Recent assignments</h2><p>Prioritise active reports and record repair progress.</p></div><Link to="/officer/reports">View all assigned reports</Link></div>
      {reports.length === 0 ? <p className="officer-dashboard__state">No reports are assigned to you yet.</p> : <div className="officer-assignment-list">{reports.map((report) => <article key={report.id}>
        <div className="officer-assignment-list__image">{report.image_url ? <img src={getServerUrl(report.image_url)} alt="Reported pothole" /> : <FiMapPin />}</div>
        <div className="officer-assignment-list__summary"><code>#{report.id.slice(0, 8)}</code><strong>{report.location}</strong><span>{report.date}</span></div>
        <div className="officer-assignment-list__meta"><SeverityBadge severity={report.severity} /><StatusBadge status={report.status} /></div>
        <Link to={`/officer/reports/${report.id}`}>View report</Link>
      </article>)}</div>}
    </section>
  </main>;
};
