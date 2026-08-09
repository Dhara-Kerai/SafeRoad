import { useEffect, useState } from 'react';
import {
  ActivityChart,
  KPISection,
  LiveMapCard,
  QuickActions,
  RecentReports,
  Timeline,
  WelcomeSection,
} from '../../components/dashboard';
import type {
  DashboardStats,
  MonthlyTrendItem,
  RecentReportItem,
} from '../../services/analyticsService';
import {
  fetchDashboardStats,
  fetchMonthlyTrends,
  fetchRecentReports,
} from '../../services/analyticsService';

import './Dashboard.css';

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentReports, setRecentReports] = useState<RecentReportItem[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrendItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [statsData, recentData, trendsData] = await Promise.allSettled([
          fetchDashboardStats(),
          fetchRecentReports(),
          fetchMonthlyTrends(),
        ]);

        if (!isMounted) return;

        if (statsData.status === 'fulfilled') {
          setStats(statsData.value);
        }
        if (recentData.status === 'fulfilled') {
          setRecentReports(recentData.value);
        }
        if (trendsData.status === 'fulfilled') {
          setMonthlyTrends(trendsData.value);
        }

        if (
          statsData.status === 'rejected' &&
          recentData.status === 'rejected' &&
          trendsData.status === 'rejected'
        ) {
          setError('Failed to load dashboard statistics from backend server.');
        }
      } catch (err) {
        if (isMounted) {
          setError('An unexpected error occurred while loading dashboard statistics.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="dashboard">
      <WelcomeSection />
      <QuickActions />
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '0.5rem', marginBottom: '1rem' }} role="alert">
          {error}
        </div>
      )}
      <KPISection stats={stats} isLoading={isLoading} />

      <section className="dashboard-grid">
        <LiveMapCard />
        <RecentReports reports={recentReports} isLoading={isLoading} />
      </section>

      <section className="dashboard-grid dashboard-grid--bottom">
        <ActivityChart trends={monthlyTrends} isLoading={isLoading} />
        <Timeline reports={recentReports} isLoading={isLoading} />
      </section>
    </main>
  );
};

