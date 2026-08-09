// Citizen report catalogue with frontend-only filters and view controls.
import { useEffect, useMemo, useState } from 'react';
import { getAssignedReports, getMyReports } from '../../services/reportManagementService';
import { ReportCard } from '../../components/reportManagement/ReportCard';
import { ReportStatistics } from '../../components/reportManagement/ReportStatistics';
import type { ManagedReport } from '../../types/reportManagement';
import { useAuth } from '../../context/AuthContext';
import './MyReports.css';

export const MyReports = () => {
  const { currentUser } = useAuth();
  const isOfficer = currentUser?.role === 'municipal_officer';
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [sort, setSort] = useState('newest');
  const [grid, setGrid] = useState(true);
  const [page, setPage] = useState(1);

  const [allReports, setAllReports] = useState<ManagedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (isOfficer ? getAssignedReports : getMyReports)({ page: 1, size: 100 })
      .then((data) => {
        if (active) {
          setAllReports(data.items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to load reports');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [isOfficer]);

  const reports = useMemo(() => {
    return allReports
      .filter((report) => 
        (status === 'All' || report.status === status) && 
        (severity === 'All' || report.severity === severity) && 
        `${report.id} ${report.location}`.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => sort === 'newest' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id));
  }, [allReports, query, severity, sort, status]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [query, status, severity, sort]);

  const itemsPerPage = 8;
  const totalPages = Math.ceil(reports.length / itemsPerPage) || 1;
  const paginatedReports = useMemo(() => {
    return reports.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  }, [reports, page]);

  if (loading) {
    return (
      <main className="my-reports">
        <header>
          <p className="eyebrow">{isOfficer ? 'OPERATIONS' : 'CITIZEN REPORTING'}</p>
          <h1>{isOfficer ? 'Assigned Reports' : 'My Reports'}</h1>
          <p>{isOfficer ? 'Review and update reports assigned to you.' : 'Track each road-safety report from submission to completion.'}</p>
        </header>
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
          <p>Loading reports...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="my-reports">
        <header>
          <p className="eyebrow">{isOfficer ? 'OPERATIONS' : 'CITIZEN REPORTING'}</p>
          <h1>{isOfficer ? 'Assigned Reports' : 'My Reports'}</h1>
          <p>{isOfficer ? 'Review and update reports assigned to you.' : 'Track each road-safety report from submission to completion.'}</p>
        </header>
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--error)' }}>
          <p>Error: {error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="my-reports">
      <header>
        <p className="eyebrow">{isOfficer ? 'OPERATIONS' : 'CITIZEN REPORTING'}</p>
        <h1>{isOfficer ? 'Assigned Reports' : 'My Reports'}</h1>
        <p>{isOfficer ? 'Review and update reports assigned to you.' : 'Track each road-safety report from submission to completion.'}</p>
      </header>
      <ReportStatistics reports={allReports} />
      <section className="report-filter-bar">
        <input 
          aria-label="Search reports" 
          placeholder="Search report ID or location" 
          value={query} 
          onChange={(event) => setQuery(event.target.value)} 
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>All</option>
          {['Reported', 'AI Verified', 'Officer Verified', 'Repair Assigned', 'Under Repair', 'Completed'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
          <option>All</option>
          {['Low', 'Medium', 'High', 'Critical'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button className="button-secondary" onClick={() => setGrid((value) => !value)}>
          {grid ? 'List view' : 'Grid view'}
        </button>
      </section>
      
      {reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
          <p style={{ color: 'var(--muted)', margin: 0 }}>No reports found.</p>
        </div>
      ) : (
        <div className={grid ? 'reports-grid' : 'reports-list'}>
          {paginatedReports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      {reports.length > 0 && (
        <nav className="pagination" aria-label="Report pagination">
          <button 
            className="button-secondary" 
            disabled={page === 1} 
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <strong>{page} of {totalPages}</strong>
          <button 
            className="button-secondary" 
            disabled={page === totalPages} 
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
};
