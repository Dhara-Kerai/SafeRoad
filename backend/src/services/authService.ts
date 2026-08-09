import prisma from '../config/db';
import { RegisterInput, LoginInput } from '../validations/authValidation';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import { randomBytes, randomInt } from 'crypto';
import { sendOtpEmail } from "./emailService";

import {
  ForgotPasswordInput,
  VerifyOtpInput,
  ResetPasswordInput,
} from '../validations/authValidation';

const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_LOCKOUT_MS = 15 * 60 * 1000;
const RECOVERY_CREDENTIALS_ERROR = 'Recovery credentials are invalid, expired, or temporarily locked. Try again later or request a new code.';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const INVALID_LOGIN_ERROR = 'Invalid email or password';

export const registerUser = async (input: RegisterInput) => {
  const { fullName, name, email, password } = input;
  const resolvedFullName = fullName || name || '';

  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError('Email is already registered', 400);
  }

  // 2. Hash password
  const passwordHash = await hashPassword(password);

  // 3. Create user
  const user = await prisma.user.create({
    data: {
      fullName: resolvedFullName,
      email,
      password: passwordHash,
      role: 'USER',
    },
  });


  // 4. Return user info without password
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const updateUserRole = async (userId: string, role: 'OFFICER' | 'ADMIN' | 'USER') => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  // 1. Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(INVALID_LOGIN_ERROR, 401);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(INVALID_LOGIN_ERROR, 401);
  }

  // 2. Verify password
  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    const priorFailedAttempts =
      user.lockedUntil && user.lockedUntil <= new Date() ? 0 : user.failedLoginAttempts;
    const failedLoginAttempts = priorFailedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts,
        lockedUntil:
          failedLoginAttempts >= LOGIN_MAX_ATTEMPTS
            ? new Date(Date.now() + LOGIN_LOCKOUT_MS)
            : null,
      },
    });
    throw new AppError(INVALID_LOGIN_ERROR, 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  // 3. Generate Token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // 4. Return user and token
  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
};

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const createRefreshToken = async (userId: string): Promise<string> => {
  const secret = randomBytes(32).toString('hex');
  const refreshToken = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: await hashPassword(secret),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return `${refreshToken.id}.${secret}`;
};

export const rotateRefreshToken = async (token: string) => {
  const [tokenId, secret] = token.split('.', 2);
  const storedToken = tokenId && secret
    ? await prisma.refreshToken.findUnique({
        where: { id: tokenId },
        include: { user: true },
      })
    : null;

  if (!storedToken) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
  if (!(await comparePassword(secret, storedToken.tokenHash))) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
  if (storedToken.expiresAt <= new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new AppError('Invalid or expired refresh token', 401);
  }
  if (storedToken.usedAt) {
    // A valid secret for an already-used record indicates token theft or a race.
    await prisma.refreshToken.deleteMany({ where: { userId: storedToken.userId } });
    throw new AppError('Invalid or expired refresh token', 401);
  }

  let reuseDetected = false;
  let refreshToken: string;
  try {
    refreshToken = await prisma.$transaction(async (tx) => {
      const markedUsed = await tx.refreshToken.updateMany({
        where: { id: storedToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (markedUsed.count !== 1) {
        reuseDetected = true;
        throw new Error('Refresh token was already used');
      }

      const nextSecret = randomBytes(32).toString('hex');
      const nextToken = await tx.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: await hashPassword(nextSecret),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });
      return `${nextToken.id}.${nextSecret}`;
    });
  } catch (error) {
    if (reuseDetected) {
      await prisma.refreshToken.deleteMany({ where: { userId: storedToken.userId } });
      throw new AppError('Invalid or expired refresh token', 401);
    }
    throw error;
  }

  return {
    token: generateToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    }),
    refreshToken,
  };
};

export const revokeRefreshToken = async (token?: string): Promise<void> => {
  const [tokenId, secret] = token?.split('.', 2) ?? [];
  if (!tokenId || !secret) return;

  const storedToken = await prisma.refreshToken.findUnique({ where: { id: tokenId } });
  if (storedToken && (await comparePassword(secret, storedToken.tokenHash))) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
  }
};

/* Superseded reset implementation retained only as source history; do not execute. */
/*
export const requestPasswordReset = async ({ email }: ForgotPasswordInput) => {
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`🔍 [AuthService] Password reset requested for email: "${email}" (normalized: "${normalizedEmail}")`);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    console.warn(`⚠️ [AuthService] Password reset failed - User not found for email: "${normalizedEmail}"`);
    throw new AppError('No account found with that email address.', 404);
  }

  const otp = randomInt(100000, 1000000).toString();
  console.log('✅ [AuthService] OTP Generated:', otp);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.$transaction([
    prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
    prisma.passwordReset.create({
      data: {
        userId: user.id,
        otpHash: await hashPassword(otp),
        expiresAt,
      },
    }),
  ]);
  console.log('✅ [AuthService] OTP Stored in Database');

  console.log('📧 [AuthService] Calling sendOtpEmail...');
  await sendOtpEmail(user.email, otp);
  console.log('✅ [AuthService] Returned from sendOtpEmail successfully');
  return otp;
};
*/

export const requestPasswordReset = async ({ email }: ForgotPasswordInput): Promise<string | null> => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Use the same external response for known and unknown accounts.
  if (!user) return null;

  const otp = randomInt(100000, 1000000).toString();
  if (process.env.NODE_ENV === 'development') {
    console.info('[AuthService] Password reset OTP generated:', otp);
  }

  await prisma.$transaction([
    prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
    prisma.passwordReset.create({
      data: {
        userId: user.id,
        otpHash: await hashPassword(otp),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    }),
  ]);
  await sendOtpEmail(user.email, otp);
  return otp;
};

export const verifyPasswordResetOtp = async ({ email, code }: VerifyOtpInput) => {
  const reset = await prisma.passwordReset.findFirst({
    where: {
      user: { email },
      expiresAt: { gt: new Date() },
      verifiedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!reset || (reset.lockedUntil && reset.lockedUntil > new Date())) {
    throw new AppError(RECOVERY_CREDENTIALS_ERROR, 400);
  }

  if (!(await comparePassword(code, reset.otpHash))) {
    const failedAttempts = reset.failedAttempts + 1;
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: {
        failedAttempts,
        lockedUntil:
          failedAttempts >= PASSWORD_RESET_MAX_ATTEMPTS
            ? new Date(Date.now() + PASSWORD_RESET_LOCKOUT_MS)
            : undefined,
      },
    });
    throw new AppError(RECOVERY_CREDENTIALS_ERROR, 400);
  }

  const token = randomBytes(32).toString('hex');
  await prisma.passwordReset.update({
    where: { id: reset.id },
    data: {
      resetTokenHash: await hashPassword(token),
      verifiedAt: new Date(),
    },
  });

  // Prefix the opaque secret with the reset record id so failed reset-password
  // attempts can be counted against the exact targeted recovery record.
  return `${reset.id}.${token}`;
};

export const resetPassword = async ({ token, password }: ResetPasswordInput) => {
  const [resetId, resetSecret] = token.split('.', 2);
  const reset = resetId && resetSecret
    ? await prisma.passwordReset.findFirst({
    where: {
      id: resetId,
      verifiedAt: { not: null },
      resetTokenHash: { not: null },
      expiresAt: { gt: new Date() },
    },
  })
    : null;

  if (!reset || (reset.lockedUntil && reset.lockedUntil > new Date())) {
    throw new AppError(RECOVERY_CREDENTIALS_ERROR, 400);
  }

  if (!(await comparePassword(resetSecret, reset.resetTokenHash!))) {
    const failedAttempts = reset.failedAttempts + 1;
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: {
        failedAttempts,
        lockedUntil:
          failedAttempts >= PASSWORD_RESET_MAX_ATTEMPTS
            ? new Date(Date.now() + PASSWORD_RESET_LOCKOUT_MS)
            : undefined,
      },
    });
    throw new AppError(RECOVERY_CREDENTIALS_ERROR, 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { password: await hashPassword(password) },
    }),
    prisma.passwordReset.delete({ where: { id: reset.id } }),
  ]);
};
