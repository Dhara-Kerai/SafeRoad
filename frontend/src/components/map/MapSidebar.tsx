import { FiMapPin, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { MapReport } from '../../types/map';
import { formatReportDate } from '../../services/mapService';
import { getServerUrl } from '../../services/reportService';

interface MapSidebarProps { report: MapReport | null; onClose: () => void; }

export const MapSidebar = ({ report, onClose }: MapSidebarProps) => {
  const navigate = useNavigate();
  if (!report) return <aside className="map-sidebar map-sidebar--empty"><FiMapPin /><p>Select a report marker to review its details.</p></aside>;

  return <aside className="map-sidebar"><header><div><span>SELECTED REPORT</span><h2>Report #{report.id.slice(0, 8)}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close report details"><FiX /></button></header><div className="map-sidebar__content"><div className="map-sidebar__badges"><b className={`severity-badge severity-badge--${report.severity.toLowerCase()}`}>{report.severity}</b><b className="status-badge">{report.status}</b></div>{report.imageUrl ? <img className="map-sidebar__image" src={getServerUrl(report.imageUrl)} alt={`Evidence for report ${report.id.slice(0, 8)}`} /> : <div className="map-sidebar__image"><FiMapPin /><span>No evidence image uploaded</span></div>}<dl>{report.address ? <div><dt>Location</dt><dd>{report.address}</dd></div> : null}<div><dt>Reported</dt><dd>{formatReportDate(report.createdAt)}</dd></div><div><dt>Coordinates</dt><dd>{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</dd></div>{report.reporter ? <div><dt>Reporter</dt><dd>{report.reporter}</dd></div> : null}<div><dt>Assigned officer</dt><dd>{report.assignedOfficer || 'Unassigned'}</dd></div>{report.department ? <div><dt>Department</dt><dd>{report.department}</dd></div> : null}{report.aiConfidence ? <div><dt>AI confidence</dt><dd>{report.aiConfidence}%</dd></div> : null}</dl>{report.description ? <section><h3>Description</h3><p>{report.description}</p></section> : null}</div><footer><button type="button" className="button-primary" onClick={() => navigate(`/report/${report.id}`)}>View Report</button></footer></aside>;
};
