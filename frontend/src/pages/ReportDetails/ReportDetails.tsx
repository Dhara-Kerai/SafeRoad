// Full citizen report view with backend integration and workflow status updates.
import { useEffect, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getReportById, updateReportStatus, updateOfficerReportStatus, assignOfficerToReport } from '../../services/reportManagementService';
import { fetchOfficers } from '../../services/adminService';
import { CommentSection } from '../../components/reportManagement/CommentSection';
import { ReportTimeline } from '../../components/reportManagement/ReportTimeline';
import { SeverityBadge, StatusBadge } from '../../components/reportManagement/ReportBadges';
import { AIResultCard } from '../../components/report/AIResultCard';
import { getServerUrl } from '../../services/reportService';
import { useAuth } from '../../context/AuthContext';
import type { ManagedReport } from '../../types/reportManagement';
import type { AdminOfficer } from '../../types/admin';
import './ReportDetails.css';

export const ReportDetails = () => {
  const { reportId } = useParams();
  const { currentUser } = useAuth();
  const [report, setReport] = useState<ManagedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusRemarks, setStatusRemarks] = useState('');
  const [updating, setUpdating] = useState(false);

  // Admin Officer Assignment state
  const [officersList, setOfficersList] = useState<AdminOfficer[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [assignNotice, setAssignNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isMunicipalOfficer = currentUser?.role === 'municipal_officer';
  const isOfficer = isMunicipalOfficer || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  const loadReport = useCallback(() => {
    if (!reportId) return;
    setLoading(true);
    setError(null);
    getReportById(reportId)
      .then((data) => {
        setReport(data);
        if (data.officerId) {
          setSelectedOfficerId(data.officerId);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load report');
        setLoading(false);
      });
  }, [reportId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (isAdmin) {
      void fetchOfficers()
        .then((officers) => setOfficersList(officers))
        .catch(() => console.warn('Could not load officers list for admin assignment'));
    }
  }, [isAdmin]);

  const handleStatusUpdate = async (nextStatus: string) => {
    if (!report) return;
    setUpdating(true);
    try {
      if (isMunicipalOfficer) {
        await updateOfficerReportStatus(report.id, nextStatus as 'IN_PROGRESS' | 'FIXED', statusRemarks);
      } else {
        await updateReportStatus(report.id, nextStatus, statusRemarks);
      }
      setStatusRemarks('');
      const updated = await getReportById(report.id);
      setReport(updated);
    } catch (e: any) {
      alert(e.message || 'Failed to update workflow status. Make sure the transition is valid.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignOfficer = async () => {
    if (!report || !selectedOfficerId) return;
    setAssigning(true);
    setAssignNotice(null);
    try {
      await assignOfficerToReport(report.id, selectedOfficerId);
      setAssignNotice({ message: 'Officer assigned successfully!', type: 'success' });
      loadReport();
    } catch (e: any) {
      setAssignNotice({ message: e.message || 'Failed to assign officer.', type: 'error' });
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <main className="report-details">
        <header>
          <h1>Report details</h1>
        </header>
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
          <p>Loading report details...</p>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="report-details">
        <header>
          <h1>Report details</h1>
        </header>
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--error)' }}>
          <p>Error: {error || 'Report not found'}</p>
        </div>
      </main>
    );
  }

  const statusOptions = [
    { label: 'Reported', value: 'REPORTED' },
    { label: 'AI Verified', value: 'AI_VERIFIED' },
    { label: 'Officer Assigned', value: 'OFFICER_ASSIGNED' },
    { label: 'Under Repair', value: 'IN_PROGRESS' },
    { label: 'Fixed', value: 'FIXED' },
    { label: 'Quality Check', value: 'QUALITY_CHECK' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Closed', value: 'CLOSED' },
    { label: 'Needs Review', value: 'NEEDS_REVIEW' },
    { label: 'Rejected', value: 'REJECTED' },
  ];
  const nextStatusesByRole: Record<string, string[]> = isMunicipalOfficer
    ? {
        OFFICER_ASSIGNED: ['IN_PROGRESS'],
        IN_PROGRESS: ['FIXED'],
      }
    : {
        REPORTED: ['AI_VERIFIED', 'NEEDS_REVIEW', 'REJECTED', 'OFFICER_ASSIGNED'],
        AI_VERIFIED: ['NEEDS_REVIEW', 'REJECTED', 'OFFICER_ASSIGNED'],
        NEEDS_REVIEW: ['AI_VERIFIED', 'REJECTED', 'OFFICER_ASSIGNED'],
        FIXED: ['QUALITY_CHECK'],
        QUALITY_CHECK: ['COMPLETED'],
        COMPLETED: ['CLOSED'],
      };
  const availableStatusOptions = statusOptions.filter((option) =>
    nextStatusesByRole[report.status]?.includes(option.value)
  );

  return (
    <main className="report-details">
      <header>
        <p className="eyebrow">REPORT #{report.id.slice(0, 8)}</p>
        <h1>Report details</h1>
        <div className="report-badges">
          <SeverityBadge severity={report.severity} />
          <StatusBadge status={report.status} />
        </div>
      </header>
      <section className="details-grid">
        <div>
          <section className="detail-section">
            <div className="detail-image" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {report.image_url ? (
                <img 
                  src={getServerUrl(report.image_url)} 
                  alt={report.imageLabel} 
                  style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '9px', objectFit: 'cover' }} 
                />
              ) : (
                <span>{report.imageLabel}</span>
              )}
            </div>
            <h2>{report.location}</h2>
            <p>{report.description}</p>
            <dl>
              <div>
                <dt>Road type</dt>
                <dd>{report.roadType}</dd>
              </div>
              <div>
                <dt>GPS coordinates</dt>
                <dd>{report.latitude !== undefined && report.longitude !== undefined ? <a href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=18/${report.latitude}/${report.longitude}`} target="_blank" rel="noreferrer">{report.latitude.toFixed(6)}, {report.longitude.toFixed(6)} · View map</a> : 'Not available'}</dd>
              </div>
              <div>
                <dt>Traffic level</dt>
                <dd>{report.traffic}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{report.date}</dd>
              </div>
              <div>
                <dt>Submitted by</dt>
                <dd>{report.reporterName ? `${report.reporterName}${report.reporterEmail ? ` (${report.reporterEmail})` : ''}` : 'Citizen User'}</dd>
              </div>
              <div>
                <dt>Assigned Officer</dt>
                <dd>
                  {report.assignedOfficerName ? (
                    <span>
                      {report.assignedOfficerName}
                      {report.assignedOfficerBadge ? ` [${report.assignedOfficerBadge}]` : ''}
                      {report.assignedOfficerDepartment ? ` - ${report.assignedOfficerDepartment}` : ''}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontWeight: 'normal' }}>Unassigned</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>AI prediction</dt>
                <dd>
                  {report.aiResult || report.aiDetails || report.aiConfidence !== undefined ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{report.aiVerified ? 'Pothole detected' : 'No pothole detected'}</span>
                      {report.aiConfidence !== undefined && report.aiConfidence !== null && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          Confidence: {report.aiConfidence > 1 ? Math.round(report.aiConfidence) : Math.round(report.aiConfidence * 100)}%
                        </span>
                      )}
                      {report.aiSeverity && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          AI Severity: {report.aiSeverity}
                        </span>
                      )}
                    </div>
                  ) : (
                    'No AI result stored yet'
                  )}
                </dd>
              </div>
            </dl>
          </section>
          
          <section className="detail-section">
            <h2>Attachments</h2>
            <div className="attachment-grid">
              <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                {report.image_url ? (
                  <img 
                    src={getServerUrl(report.image_url)} 
                    alt="Original uploaded" 
                    style={{ maxWidth: '100%', maxHeight: '90px', borderRadius: '4px', objectFit: 'contain' }} 
                  />
                ) : (
                  <span>Original uploaded image</span>
                )}
              </div>
              <div>Future repair image</div>
            </div>
          </section>

          <div style={{ margin: '20px 0' }}>
            <AIResultCard result={report.aiResult} report={report} />
          </div>
          
          {reportId && <CommentSection reportId={reportId} />}
        </div>
        
        <aside>
          <div className="detail-section">
            <h2>Status timeline</h2>
            <ReportTimeline status={report.status} />
          </div>

          {isAdmin && (
            <div className="detail-section" style={{ marginTop: '20px', background: 'var(--surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>Assign Officer (Admin)</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px 0' }}>
                Dispatch an officer to verify or manage repairs for this incident.
              </p>

              {assignNotice && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '10px',
                  background: assignNotice.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  color: assignNotice.type === 'error' ? '#ef4444' : '#22c55e',
                  border: `1px solid ${assignNotice.type === 'error' ? '#ef4444' : '#22c55e'}`
                }}>
                  {assignNotice.message}
                </div>
              )}

              <div style={{ display: 'grid', gap: '10px' }}>
                <select
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  disabled={assigning}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-soft)', color: 'var(--text)' }}
                >
                  <option value="">Select Officer...</option>
                  {officersList.map((officer) => (
                    <option key={officer.id} value={officer.id}>
                      {officer.name} {officer.badgeNumber ? `[${officer.badgeNumber}]` : ''} - {officer.department}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAssignOfficer}
                  disabled={assigning || !selectedOfficerId}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: (assigning || !selectedOfficerId) ? 'not-allowed' : 'pointer',
                    opacity: (assigning || !selectedOfficerId) ? 0.6 : 1
                  }}
                >
                  {assigning ? 'Assigning...' : report.assignedOfficerName ? 'Change Assigned Officer' : 'Save & Assign Officer'}
                </button>
              </div>
            </div>
          )}

          {isOfficer && (
            <div className="detail-section" style={{ marginTop: '20px' }}>
              <h3>Update status ({isAdmin ? 'Admin' : 'Officer'})</h3>
              <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                <textarea 
                  value={statusRemarks} 
                  onChange={(e) => setStatusRemarks(e.target.value)} 
                  placeholder="Add status change remarks..." 
                  style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-soft)', color: 'var(--text)' }}
                />
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      handleStatusUpdate(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  disabled={updating}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                >
                  <option value="">Select next status...</option>
                  {availableStatusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
};
