import { Request, Response, NextFunction } from 'express';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validations/authValidation';
import * as authService from '../services/authService';
import { AppError } from '../middleware/errorHandler';
import { generateToken } from '../utils/jwt';

const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: ACCESS_COOKIE_MAX_AGE,
  path: '/',
};

const refreshCookieOptions = {
  ...accessCookieOptions,
  maxAge: REFRESH_COOKIE_MAX_AGE,
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((e: { message: string }) => e.message)
        .join(', ');
      return next(new AppError(errorMsg, 400));
    }

    const user = await authService.registerUser(parseResult.data);

    // Generate JWT token upon registration to support immediate auto-login in frontend
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await authService.createRefreshToken(user.id);
    res.cookie('token', token, accessCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    res.status(201).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((e: { message: string }) => e.message)
        .join(', ');
      return next(new AppError(errorMsg, 400));
    }

    const data = await authService.loginUser(parseResult.data);

    const refreshToken = await authService.createRefreshToken(data.user.id);
    res.cookie('token', data.token, accessCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    res.status(200).json({
      status: 'success',
      data: { user: data.user },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authService.revokeRefreshToken(req.cookies?.refreshToken);
    res.clearCookie('token', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await authService.rotateRefreshToken(req.cookies?.refreshToken ?? '');
    res.cookie('token', data.token, accessCookieOptions);
    res.cookie('refreshToken', data.refreshToken, refreshCookieOptions);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const user = await authService.getUserProfile(req.user.userId);
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) return next(validationError(parseResult.error.issues));

    const user = await authService.updateUserProfile(req.user.userId, parseResult.data);
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) return next(validationError(parseResult.error.issues));

    await authService.changeUserPassword(req.user.userId, parseResult.data);
    res.status(200).json({ status: 'success', message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

const validationError = (issues: { message: string }[]) =>
  new AppError(issues.map((issue) => issue.message).join(', '), 400);

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) return next(validationError(parseResult.error.issues));

    const otp = await authService.requestPasswordReset(parseResult.data);
    const response: { status: string; message: string; data?: { otp: string } } = {
      status: 'success',
      message: 'A verification code has been sent to your email address.',
    };
    if (otp && process.env.NODE_ENV !== 'production') {
      console.info(`[Auth] Password reset OTP for ${parseResult.data.email}: ${otp}`);
      response.data = { otp };
    }
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = verifyOtpSchema.safeParse(req.body);
    if (!parseResult.success) return next(validationError(parseResult.error.issues));

    const token = await authService.verifyPasswordResetOtp(parseResult.data);
    res.status(200).json({ status: 'success', data: { token } });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) return next(validationError(parseResult.error.issues));

    await authService.resetPassword(parseResult.data);
    res.status(200).json({ status: 'success', message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};
