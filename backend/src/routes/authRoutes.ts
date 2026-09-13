import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  logout,
  getProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  refresh,
  updateProfile,
  changePassword,
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

import { env } from '../config/env';

const router = Router();

const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 10 : 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

router.post('/register', authAttemptLimiter, register);
router.post('/login', authAttemptLimiter, login);
router.post('/forgot-password', authAttemptLimiter, forgotPassword);
router.post('/verify-otp', authAttemptLimiter, verifyOtp);
router.post('/reset-password', authAttemptLimiter, resetPassword);
router.post('/refresh', authAttemptLimiter, refresh);
router.post('/logout', logout);
router.get('/profile', protect, getProfile);
router.get('/me', protect, getProfile);
router.patch('/profile', protect, updateProfile);
router.post('/change-password', protect, changePassword);

export default router;
