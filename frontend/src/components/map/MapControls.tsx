import { FiCrosshair, FiMinus, FiPlus, FiRotateCcw } from 'react-icons/fi';

interface MapControlsProps {
  heatmap: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onLocate: () => void;
  onToggleHeatmap: () => void;
}

export const MapControls = ({ heatmap, onZoomIn, onZoomOut, onReset, onLocate, onToggleHeatmap }: MapControlsProps) => (
  <div className="map-controls" aria-label="Map controls">
    <button type="button" onClick={onZoomIn} aria-label="Zoom in"><FiPlus /></button>
    <button type="button" onClick={onZoomOut} aria-label="Zoom out"><FiMinus /></button>
    <button type="button" onClick={onReset} aria-label="Reset map view"><FiRotateCcw /></button>
    <button type="button" onClick={onLocate} aria-label="Show my location" title="Show my location"><FiCrosshair /></button>
    <button type="button" className={heatmap ? 'map-controls__heatmap--active' : ''} aria-pressed={heatmap} onClick={onToggleHeatmap}>{heatmap ? 'Markers' : 'Heatmap'}</button>
  </div>
);
