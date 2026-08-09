// Map integration placeholder preserving the future map provider area.
import { Link } from 'react-router-dom';
import { FiArrowUpRight } from 'react-icons/fi';

export const LiveMapCard = () => {
  return (
    <article className="panel map-panel">
      <header>
        <div>
          <h2>Live road safety map</h2>
          <p>Real-time incident overview across regional roads</p>
        </div>
        <Link className="text-button" to="/live-map">Open full map <FiArrowUpRight /></Link>
      </header>
      <div className="map-placeholder">
        <div className="map-road road-one" />
        <div className="map-road road-two" />
        <div className="map-road road-three" />
        <span className="map-pin map-pin--critical" />
        <span className="map-pin map-pin--warning" />
        <span className="map-pin map-pin--safe" />
        <div className="map-legend">
          <span><i className="legend-critical" /> Critical</span>
          <span><i className="legend-warning" /> High</span>
          <span><i className="legend-safe" /> Resolved</span>
        </div>
      </div>
    </article>
  );
};
