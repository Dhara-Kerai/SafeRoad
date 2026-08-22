import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapReport, MapSeverity } from '../../types/map';

interface InteractiveMapProps {
  reports?: MapReport[];
  selectedReport?: MapReport | null;
  currentLocation?: [number, number] | null;
  zoom?: number;
  heatmap?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onSelect?: (report: MapReport) => void;
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

const severityColor = (severity: MapSeverity): string => ({ Low: '#22c55e', Medium: '#eab308', High: '#f97316', Critical: '#ef4444' })[severity];
const severityRadius = (severity: MapSeverity): number => ({ Low: 180, Medium: 300, High: 480, Critical: 680 })[severity];

const markerIcon = (severity: MapSeverity, selected: boolean) => {
  const size = selected ? 34 : 26;
  return L.divIcon({
    className: 'custom-leaflet-marker-wrapper',
    html: `<div class="custom-map-pin ${selected ? 'leaflet-marker-pulse' : ''}" style="width:${size}px;height:${size}px;background:${severityColor(severity)};border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;background:#fff;border-radius:50%;transform:rotate(45deg)"></div></div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size],
  });
};

const MapViewController = ({ reports, selectedReport, currentLocation, zoom: zoomOffset }: Pick<InteractiveMapProps, 'reports' | 'selectedReport' | 'currentLocation' | 'zoom'>) => {
  const map = useMap();
  useEffect(() => { if (selectedReport) map.flyTo([selectedReport.latitude, selectedReport.longitude], 13, { duration: 1.2 }); }, [map, selectedReport]);
  useEffect(() => { if (currentLocation) map.flyTo(currentLocation, 15, { duration: 1.2 }); }, [map, currentLocation]);
  useEffect(() => {
    if (!selectedReport && !currentLocation && reports && reports.length) map.fitBounds(reports.map((report) => [report.latitude, report.longitude] as [number, number]), { padding: [36, 36], maxZoom: 13 });
  }, [map, reports, selectedReport, currentLocation]);
  useEffect(() => { if (typeof zoomOffset === 'number') map.setZoom(DEFAULT_ZOOM + (zoomOffset - 1)); }, [map, zoomOffset]);
  return null;
};

const formatDate = (value: string): string => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export const InteractiveMap = ({ reports = [], selectedReport, currentLocation = null, zoom = 1, heatmap = false, isLoading = false, error = null, onSelect }: InteractiveMapProps) => (
  <section className="interactive-map-container" aria-label="Interactive OpenStreetMap road safety map">
    <div className="map-placeholder__legend">Live report locations (OpenStreetMap)</div>
    {isLoading ? <div className="map-overlay-banner map-overlay-banner--loading">Loading live incident markers...</div> : null}
    {error ? <div className="map-overlay-banner map-overlay-banner--error">Error loading map data: {error}</div> : null}
    {!isLoading && !error && reports.length === 0 ? <div className="map-overlay-banner map-overlay-banner--empty">No reports with valid coordinates were found for this view.</div> : null}
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} zoomControl={false} scrollWheelZoom className="leaflet-map-root">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapViewController reports={reports} selectedReport={selectedReport} currentLocation={currentLocation} zoom={zoom} />
      {currentLocation ? <CircleMarker center={currentLocation} radius={8} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.9 }}><Popup>Your current location</Popup></CircleMarker> : null}
      {heatmap ? reports.map((report) => <Circle key={report.id} center={[report.latitude, report.longitude]} radius={severityRadius(report.severity)} pathOptions={{ color: severityColor(report.severity), fillColor: severityColor(report.severity), fillOpacity: 0.28, weight: 1 }} eventHandlers={{ click: () => onSelect?.(report) }} />) : reports.map((report) => (
        <Marker key={report.id} position={[report.latitude, report.longitude]} icon={markerIcon(report.severity, selectedReport?.id === report.id)} eventHandlers={{ click: () => onSelect?.(report) }}>
          <Popup className="safe-road-map-popup"><div className="map-popup-content"><h4 className="map-popup-title">Report #{report.id.slice(0, 8)}</h4><div className="map-popup-badges"><span className={`severity-badge severity-badge--${report.severity.toLowerCase()}`}>{report.severity}</span><span className="status-badge">{report.status}</span></div><p className="map-popup-date"><strong>Location:</strong> {report.address}</p><p className="map-popup-date"><strong>Reported:</strong> {formatDate(report.createdAt)}</p><Link className="map-popup-link" to={`/report/${report.id}`}>View Report</Link></div></Popup>
        </Marker>
      ))}
    </MapContainer>
  </section>
);
