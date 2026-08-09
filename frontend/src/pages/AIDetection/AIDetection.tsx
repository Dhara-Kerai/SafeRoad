import { useCallback, useEffect, useMemo, useState } from 'react';
import { getReports } from '../../services/reportService';
import { AIResultCard } from '../../components/report/AIResultCard';
import type { ManagedReport } from '../../types/reportManagement';
import { useAuth } from '../../context/AuthContext';
import './AIDetection.css';

const hasStoredAiResult = (report: ManagedReport) => (
  Boolean(report.aiResult || report.aiDetails || report.aiConfidence !== undefined || report.aiVerified)
);

export const AIDetection = () => {
  const { currentUser } = useAuth();
  const [allReports, setAllReports] = useState<ManagedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'ai_only' | 'verified_only'>('ai_only');

  const fetchReports = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getReports({ page: 1, size: 100 })
      .then((data) => {
        if (active) {
          setAllReports(data.items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to load AI detection reports from backend');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return fetchReports();
  }, [fetchReports]);

  // Filter reports with AI detection data
  const filteredReports = useMemo(() => {
    return allReports.filter((report) => {
      const hasAi = hasStoredAiResult(report);

      if (filterType === 'ai_only' && !hasAi) return false;
      if (filterType === 'verified_only' && !report.aiVerified && !report.aiResult?.potholeDetected) return false;

      const aiSeverity = report.aiSeverity ?? report.aiResult?.severity;
      if (severityFilter !== 'All' && aiSeverity?.toLowerCase() !== severityFilter.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesId = report.id.toLowerCase().includes(query);
        const matchesLoc = report.location.toLowerCase().includes(query);
        const matchesDesc = (report.description || '').toLowerCase().includes(query);
        const matchesDamage = (report.aiResult?.damageType || '').toLowerCase().includes(query);
        if (!matchesId && !matchesLoc && !matchesDesc && !matchesDamage) return false;
      }

      return true;
    });
  }, [allReports, filterType, searchQuery, severityFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const aiReports = allReports.filter(hasStoredAiResult);
    const verified = aiReports.filter((r) => r.aiVerified || r.aiResult?.potholeDetected);
    const highSeverity = aiReports.filter((r) => {
      const aiSeverity = r.aiSeverity ?? r.aiResult?.severity;
      return Boolean(aiSeverity && ['high', 'critical'].includes(aiSeverity.toLowerCase()));
    });

    const confidences = aiReports
      .map((r) => r.aiConfidence ?? r.aiResult?.confidenceScore)
      .filter((c): c is number => typeof c === 'number');

    const avgConfidence = confidences.length
      ? Math.round((confidences.reduce((sum, val) => sum + val, 0) / confidences.length) * (confidences.some((c) => c <= 1) ? 100 : 1))
      : 0;

    return {
      totalAnalyzed: aiReports.length,
      verifiedPotholes: verified.length,
      highSeverity: highSeverity.length,
      avgConfidence: confidences.length ? `${avgConfidence}%` : 'N/A',
    };
  }, [allReports]);

  const userRole = currentUser?.role || 'citizen';

  return (
    <main className="ai-detection-page">
      <header>
        <p className="eyebrow">COMPUTER VISION & AI</p>
        <h1>AI Road Damage Detection</h1>
        <p>
          Real-time automated inspection results powered by the SafeRoad YOLO computer vision service for {userRole.replace('_', ' ')}.
        </p>
      </header>

      <section className="ai-detection-stats">
        <article>
          <span>Reports Analyzed</span>
          <strong>{stats.totalAnalyzed}</strong>
        </article>
        <article>
          <span>AI Verified Potholes</span>
          <strong>{stats.verifiedPotholes}</strong>
        </article>
        <article>
          <span>High / Critical Damage</span>
          <strong>{stats.highSeverity}</strong>
        </article>
        <article>
          <span>Avg. AI Confidence</span>
          <strong>{stats.avgConfidence}</strong>
        </article>
      </section>

      <section className="ai-detection-filter-bar">
        <input
          aria-label="Search AI detections"
          placeholder="Search report ID, location, or damage type…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="All">All Severities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
          <option value="ai_only">AI Analyzed Reports</option>
          <option value="verified_only">Verified Potholes Only</option>
          <option value="all">All Uploaded Reports</option>
        </select>
      </section>

      {loading && (
        <div className="ai-detection-loading">
          <p>Loading AI road damage detection results from backend…</p>
        </div>
      )}

      {error && (
        <div className="ai-detection-error">
          <p>Error loading AI detection data: {error}</p>
          <button type="button" className="button-secondary" onClick={fetchReports} style={{ marginTop: '12px' }}>
            Retry Loading
          </button>
        </div>
      )}

      {!loading && !error && filteredReports.length === 0 && (
        <div className="ai-detection-empty">
          <p>
            {allReports.some(hasStoredAiResult)
              ? 'No AI road damage detection results match your filter criteria.'
              : 'No AI analyzed reports yet. Submit a pothole report with an image to run AI detection.'}
          </p>
        </div>
      )}

      {!loading && !error && filteredReports.length > 0 && (
        <div className="ai-detection-grid">
          {filteredReports.map((report) => (
            <AIResultCard key={report.id} report={report} result={report.aiResult} />
          ))}
        </div>
      )}
    </main>
  );
};
