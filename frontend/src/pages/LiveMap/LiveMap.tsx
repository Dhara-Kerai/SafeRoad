import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { InteractiveMap, MapControls, MapFilters, MapKpiCards, MapLegend, MapSidebar, MapToolbar, RecentMapReports } from '../../components/map';
import { useAuth } from '../../context/AuthContext';
import { getLatestReports, getMapReports } from '../../services/mapService';
import { getLocation } from '../../services/reportService';
import { matchesMapFilters, sortMapReports, uniqueMapValues } from '../../services/mapUtils';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import type { MapFiltersState, MapReport, MapSort } from '../../types/map';
import './LiveMap.css';

const defaultFilters: MapFiltersState = {
  search: '',
  severity: 'All',
  status: 'All',
  reporter: 'All',
  date: 'All',
  city: 'All',
  vehicleType: 'All',
  verificationStatus: 'All',
  department: 'All',
};

export const LiveMap = () => {
  const [searchParams] = useSearchParams();
  const reportIdParam = searchParams.get('reportId') || searchParams.get('report');
  const [reports, setReports] = useState<MapReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MapFiltersState>(defaultFilters);
  const [selectedReport, setSelectedReport] = useState<MapReport | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [heatmap, setHeatmap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [sort, setSort] = useState<MapSort>('Newest');
  const { currentUser } = useAuth();
  const { notice, showNotice } = useTransientNotice(3500);
  const detailsRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const backendOrigin = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/api$/, '');

  const loadReports = useCallback(() => {
    setIsRefreshing(true);
    setError(null);
    getMapReports()
      .then((data) => {
        setReports(data);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to connect to backend server.');
      })
      .finally(() => {
        setIsRefreshing(false);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (reportIdParam && reports.length > 0) {
      const found = reports.find((r) => r.id === reportIdParam || r.id.startsWith(reportIdParam));
      if (found) {
        setSelectedReport(found);
      }
    }
  }, [reportIdParam, reports]);

  const handleRealtimeReport = useCallback(() => {
    // Socket payloads are only a refresh signal. The protected map endpoint is
    // the single source of truth for role-scoped reports.
    loadReports();
    showNotice('New report received on the live map.');
  }, [loadReports, showNotice]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    const socket = io(backendOrigin, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (currentUser) socket.emit('join');
    });

    if (currentUser?.role !== 'municipal_officer') {
      socket.on('report-created', handleRealtimeReport);
    }
    socket.on('error', (payload: { message?: string }) => {
      console.warn('[LiveMap Socket] Event error:', payload?.message || 'Unknown socket error');
    });

    return () => {
      socket.off('report-created', handleRealtimeReport);
      socket.disconnect();
    };
  }, [backendOrigin, currentUser, handleRealtimeReport]);

  const filteredReports = useMemo(
    () => sortMapReports(reports.filter((report) => matchesMapFilters(report, filters)), sort),
    [reports, filters, sort],
  );

  const selectReport = (report: MapReport) => {
    setSelectedReport(report);
    window.setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  };

  const locateUser = async () => {
    const location = await getLocation();
    if (location.status === 'success' && location.latitude !== undefined && location.longitude !== undefined) {
      setCurrentLocation([location.latitude, location.longitude]);
      showNotice('Map centred on your current location.');
      return;
    }
    showNotice(location.message || 'Current location is unavailable.');
  };

  return (
    <main className="live-map-page">
      <MapToolbar
        search={filters.search}
        reportCount={filteredReports.length}
        sort={sort}
        isRefreshing={isRefreshing}
        onSearchChange={(search) => setFilters({ ...filters, search })}
        onSortChange={setSort}
        onRefresh={loadReports}
        onExport={() => showNotice('Export functionality will be available after backend integration.')}
      />
      <MapKpiCards reports={reports} />
      <div className="live-map-layout">
        <MapFilters
          filters={filters}
          reporters={uniqueMapValues(reports, 'reporter')}
          cities={uniqueMapValues(reports, 'city')}
          departments={uniqueMapValues(reports, 'department')}
          statuses={uniqueMapValues(reports, 'status')}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
        />
        <div className="live-map-layout__centre">
          <InteractiveMap
            reports={filteredReports}
            selectedReport={selectedReport}
            zoom={zoom}
            heatmap={heatmap}
            currentLocation={currentLocation}
            isLoading={isLoading}
            error={error}
            onSelect={selectReport}
          />
          <MapControls
            heatmap={heatmap}
            onZoomIn={() => setZoom((value) => Math.min(value + 1, 2))}
            onZoomOut={() => setZoom((value) => Math.max(value - 1, 0))}
            onReset={() => setZoom(1)}
            onLocate={() => { void locateUser(); }}
            onToggleHeatmap={() => setHeatmap((value) => !value)}
          />
          <MapLegend />
        </div>
        <div ref={detailsRef} className="live-map-layout__details">
          <MapSidebar report={selectedReport} onClose={() => setSelectedReport(null)} />
          <RecentMapReports reports={getLatestReports(filteredReports, 8)} selectedId={selectedReport?.id} onSelect={selectReport} />
        </div>
      </div>
      {notice ? <p className="map-notice">{notice}</p> : null}
    </main>
  );
};
