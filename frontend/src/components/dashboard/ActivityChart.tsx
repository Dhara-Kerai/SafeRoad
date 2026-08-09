import type { MonthlyTrendItem } from '../../services/analyticsService';

export interface ActivityChartProps {
  trends?: MonthlyTrendItem[];
  isLoading?: boolean;
}

const formatMonthLabel = (monthKey: string) => {
  if (!monthKey) return '';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const monthNum = parseInt(parts[1], 10) - 1;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthNames[monthNum] || parts[1];
};

export const ActivityChart = ({ trends = [], isLoading }: ActivityChartProps) => {
  const maxCount = Math.max(...trends.map((t) => t.reports), 1);
  const displayItems = trends.length > 0 ? trends.slice(-7) : [];

  return (
    <article className="panel chart-panel">
      <header>
        <div>
          <h2>Report activity</h2>
          <p>Monthly incoming reports</p>
        </div>
        <button type="button" className="select-button">
          Monthly
        </button>
      </header>
      <div className="chart-placeholder">
        {isLoading ? (
          <p style={{ width: '100%', textAlign: 'center', color: '#6b7280' }}>Loading activity...</p>
        ) : displayItems.length === 0 ? (
          <p style={{ width: '100%', textAlign: 'center', color: '#6b7280' }}>No activity data available.</p>
        ) : (
          displayItems.map((item) => {
            const heightPercent = Math.max(Math.round((item.reports / maxCount) * 100), item.reports > 0 ? 10 : 0);
            return (
              <div key={item.month} style={{ height: `${heightPercent}%` }}>
                <span>{formatMonthLabel(item.month)}</span>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
};

