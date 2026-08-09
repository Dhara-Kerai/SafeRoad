import { useLocation } from 'react-router-dom';
import { SuccessCard } from '../../components/report/SuccessCard';
import './ReportSuccess.css';

export const ReportSuccess = () => {
  const location = useLocation();
  const reportId = (location.state as { reportId?: string } | null)?.reportId;

  return <main className="report-success"><SuccessCard reportId={reportId} /></main>;
};
