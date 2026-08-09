import { Router } from 'express';
import {
  getDashboard,
  getStatusDistribution,
  getSeverityDistribution,
  getReportsByCity,
  getMonthlyTrends,
  getDepartmentPerformance,
  getOfficerPerformance,
  getRecent,
} from '../controllers/analyticsController';
import { protect } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Protect all endpoints with JWT check
router.use(protect);

router.get('/dashboard', getDashboard);
router.get('/status-distribution', getStatusDistribution);
router.get('/severity-distribution', getSeverityDistribution);
router.get('/reports-by-city', getReportsByCity);
router.get('/monthly-trends', getMonthlyTrends);
router.get('/department-performance', getDepartmentPerformance);
router.get('/officer-performance', getOfficerPerformance);
router.get('/recent', getRecent);

export default router;
