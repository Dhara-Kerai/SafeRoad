import { FiAlertTriangle, FiCheckCircle, FiClock, FiMapPin, FiUsers } from 'react-icons/fi';
import type { MapReport } from '../../types/map';

interface MapKpiCardsProps { reports: MapReport[]; }

export const MapKpiCards = ({ reports }: MapKpiCardsProps) => {
  const critical = reports.filter((report) => report.severity === 'Critical').length;
  const open = reports.filter((report) => report.status !== 'Closed' && report.status !== 'Rejected').length;
  const closed = reports.filter((report) => report.status === 'Closed').length;
  const highestRiskCity = [...new Set(reports.map((report) => report.city))].sort((first, second) => reports.filter((report) => report.city === second && report.severity === 'Critical').length - reports.filter((report) => report.city === first && report.severity === 'Critical').length)[0] ?? '—';
  const cards = [{ label: 'Total reports', value: reports.length, icon: FiUsers }, { label: 'Critical reports', value: critical, icon: FiAlertTriangle }, { label: 'Open reports', value: open, icon: FiClock }, { label: 'Closed reports', value: closed, icon: FiCheckCircle }, { label: 'Highest risk city', value: highestRiskCity, icon: FiMapPin }];
  return <section className="map-kpis" aria-label="Map report statistics">{cards.map(({ label, value, icon: Icon }) => <article key={label}><Icon /><div><span>{label}</span><strong>{value}</strong></div></article>)}</section>;
};
