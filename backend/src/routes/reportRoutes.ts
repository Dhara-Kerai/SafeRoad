import { Router, Request, Response, NextFunction } from 'express';
import {
  create,
  getAll,
  getOfficerAssignments,
  getOfficerWorkload,
  updateOfficerStatus,
  getById,
  getMapReports,
  update,
  remove,
  getComments,
  addComment,
} from '../controllers/reportController';
import { protect } from '../middleware/authMiddleware';
import { uploadImage } from '../controllers/uploadController';
import { parseSingleImage } from '../middleware/uploadMiddleware';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// All report management endpoints require active authorization
router.use(protect);

router.post('/upload', parseSingleImage, uploadImage);
router.post('/', create);
router.get('/my', (req, res, next) => {
  req.query.mine = 'true';
  getAll(req, res, next);
});
router.get('/map', getMapReports);
router.get('/assigned', requireRole('OFFICER'), getOfficerAssignments);
router.get('/officer/workload', requireRole('OFFICER'), getOfficerWorkload);
router.patch('/:id/officer-status', requireRole('OFFICER'), updateOfficerStatus);
router.get('/', getAll);
router.get('/:id', getById);
const requireManagementRoleForPrivilegedChanges = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (Object.prototype.hasOwnProperty.call(req.body, 'officerId')) {
    return requireRole('ADMIN')(req, res, next);
  }
  const privilegedFields = ['status', 'departmentId'];
  if (privilegedFields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
    return requireRole('OFFICER', 'ADMIN')(req, res, next);
  }
  next();
};
router.patch('/:id', requireManagementRoleForPrivilegedChanges, update);
router.put('/:id', requireManagementRoleForPrivilegedChanges, update);
router.delete('/:id', remove);
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);

export default router;
