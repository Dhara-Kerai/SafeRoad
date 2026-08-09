import type { AIResult } from '../../types/Report';
import type { ManagedReport } from '../../types/reportManagement';
import { getServerUrl } from '../../services/reportService';

const formatConfidence = (value?: string | number | null) => {
  if (value === undefined || value === null || value === '') return 'Not available';
  if (typeof value === 'number') {
    if (value > 1) return `${Math.round(value)}%`;
    return `${Math.round(value * 100)}%`;
  }
  return value.endsWith('%') ? value : `${value}%`;
};

const formatSeverity = (value?: string | null) => {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const getDamageType = (result?: AIResult | null, details?: Record<string, unknown> | null) => {
  const detectionList = Array.isArray(details?.detections) ? details.detections as Array<Record<string, unknown>> : [];
  const firstDetection = detectionList[0];
  return result?.damageType || (typeof firstDetection?.className === 'string' ? firstDetection.className : 'Not available');
};

const getPriority = (severity?: string | null) => {
  if (!severity) return 'Standard';
  const normalized = severity.toLowerCase();
  return normalized.includes('critical') || normalized.includes('high') ? 'Urgent' : 'Standard';
};

export const AIResultCard = ({ result, report }: { result?: AIResult | null; report?: Partial<ManagedReport> | null }) => {
  const details = (result?.details && typeof result.details === 'object' ? result.details : (report?.aiDetails ?? null)) as Record<string, unknown> | null;
  const detectionList = Array.isArray(details?.detections) ? details.detections as Array<Record<string, unknown>> : [];
  const primaryDetection = detectionList[0];
  const hasStoredResult = Boolean(result || details || report?.aiConfidence !== undefined || report?.aiVerified);

  if (!hasStoredResult) {
    return (
      <article className="report-card ai-result" style={{ color: 'var(--muted)' }}>
        No AI result stored yet for this report.
      </article>
    );
  }

  const severityValue = result?.severity || (typeof details?.primarySeverity === 'string' ? details.primarySeverity : report?.aiSeverity) || 'Unknown';
  const confidenceValue = result?.confidence ?? result?.confidenceScore ?? report?.aiConfidence ?? null;
  const confidenceText = formatConfidence(confidenceValue);
  const damageType = getDamageType(result, details);
  const priority = result?.priority || getPriority(String(severityValue));

  return (
    <article className="report-card ai-result" style={{ display: 'grid', gap: '18px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>AI road damage analysis</p>
          <h2 style={{ margin: '6px 0 0', fontSize: '1.4rem' }}>{damageType}</h2>
        </div>
        <span style={{
          padding: '6px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700,
          background: severityValue.toLowerCase().includes('high') || severityValue.toLowerCase().includes('critical') ? 'rgba(239, 68, 68, 0.14)' : 'rgba(59, 130, 246, 0.12)',
          color: severityValue.toLowerCase().includes('high') || severityValue.toLowerCase().includes('critical') ? '#ef4444' : '#2563eb',
        }}>
          {formatSeverity(String(severityValue))}
        </span>
      </header>

      {report?.image_url ? (
        <div style={{ overflow: 'hidden', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <img
            src={getServerUrl(report.image_url)}
            alt="AI analyzed report"
            style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
          />
        </div>
      ) : null}

      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '14px', margin: 0 }}>
        <div>
          <dt style={{ color: 'var(--muted)', fontSize: '12px' }}>Confidence</dt>
          <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{confidenceText}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)', fontSize: '12px' }}>Severity</dt>
          <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{formatSeverity(String(severityValue))}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)', fontSize: '12px' }}>Damage type</dt>
          <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{damageType}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)', fontSize: '12px' }}>Repair priority</dt>
          <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{priority}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)', fontSize: '12px' }}>Report ID</dt>
          <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{report?.id ? report.id.slice(0, 8) : 'N/A'}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)', fontSize: '12px' }}>Location</dt>
          <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{report?.location || 'Unknown'}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)', fontSize: '12px' }}>Status</dt>
          <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{report?.status || 'Pending'}</dd>
        </div>
        <div>
          <dt style={{ color: 'var(--muted)', fontSize: '12px' }}>Created</dt>
          <dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{report?.date || 'Not available'}</dd>
        </div>
      </dl>

      {result || details ? (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'grid', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>AI analysis details</h3>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '6px', color: 'var(--muted)' }}>
            <li>Total detections: {String(typeof details?.totalDetections === 'number' ? details.totalDetections : detectionList.length)}</li>
            {typeof details?.modelVersion === 'string' ? <li>Model: {details.modelVersion}</li> : null}
            {typeof details?.imageWidth === 'number' && typeof details?.imageHeight === 'number' ? (
              <li>Image size: {details.imageWidth} × {details.imageHeight}</li>
            ) : null}
            {primaryDetection && typeof primaryDetection.box === 'object' ? (
              <li>Bounding box: {JSON.stringify(primaryDetection.box)}</li>
            ) : null}
            {primaryDetection && typeof primaryDetection.confidence === 'number' ? (
              <li>Detection confidence: {Math.round(primaryDetection.confidence * 100)}%</li>
            ) : null}
          </ul>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', color: 'var(--muted)' }}>
          No AI result stored for this report yet.
        </div>
      )}
    </article>
  );
};
