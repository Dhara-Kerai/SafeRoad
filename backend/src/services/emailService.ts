import nodemailer from 'nodemailer';
import { AppError } from '../middleware/errorHandler';

/**
 * Creates and returns a Nodemailer Transporter using SMTP settings from process.env.
 */
const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;
  const secure = port === 465;

  if (!user || !pass) {
    console.error('❌ [EmailService] SMTP credentials missing in process.env (SMTP_USER / SMTP_PASS).');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure, // true for 465, false for 587 (STARTTLS)
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Sends an OTP verification email to the specified recipient.
 */
export const sendOtpEmail = async (to: string, otp: string): Promise<void> => {
  console.log(`📧 [EmailService] Preparing to send OTP email...`);
  console.log(`📧 [EmailService] Recipient: ${to}`);

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.error('❌ [EmailService] Cannot send email: SMTP_USER or SMTP_PASS environment variables are missing.');
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[EmailService] Dev/test mode: Skipping email send for OTP ${otp}`);
      return;
    }
    throw new AppError('Server email service is not properly configured.', 500);
  }

  if (process.env.NODE_ENV === 'test') {
    console.warn(`[EmailService] Test mode: Skipping SMTP transmission for OTP ${otp}`);
    return;
  }

  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || `"SafeRoad" <${user}>`;

  const mailOptions = {
    from,
    to,
    subject: 'SafeRoad - Password Reset Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2563eb; margin: 0 0 8px 0; font-size: 24px;">SafeRoad</h2>
          <p style="color: #64748b; margin: 0; font-size: 14px;">Password Reset Verification Code</p>
        </div>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">You requested a password reset for your SafeRoad account. Please use the following 6-digit verification code to reset your password:</p>
        
        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-radius: 10px; margin: 24px 0;">
          <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${otp}</span>
        </div>
        
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">SafeRoad Security Team &bull; Safeguarding Roads Together</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [EmailService] OTP Email sent successfully to ${to}`);
    console.log(`✅ [EmailService] Message ID: ${info.messageId}`);
    console.log(`✅ [EmailService] Server Response: ${info.response}`);
  } catch (error: any) {
    console.error('❌ [EmailService] EMAIL ERROR: Failed to send OTP email');
    console.error(error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[EmailService] Dev/test mode: Suppressing email send error for OTP ${otp}`);
      return;
    }
    throw new AppError(`Failed to send email: ${error.message || 'SMTP server error'}`, 500);
  }
};