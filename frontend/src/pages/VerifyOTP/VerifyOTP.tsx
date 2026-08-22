// OTP verification form using the reusable multi-field code input with live countdown timer.
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthButton, AuthCard, AuthHeader, OTPInput } from '../../components/auth';
import { verifyOTP, forgotPassword } from '../../services/authService';

export const VerifyOTP = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (code.length !== 6) {
      setError('Enter the complete six-digit code.');
      return;
    }
    if (timeLeft <= 0) {
      setError('Verification code has expired. Please resend a new OTP.');
      return;
    }
    const email = sessionStorage.getItem('passwordResetEmail');
    if (!email) {
      setError('Request a new verification code before continuing.');
      return;
    }
    try {
      const response = await verifyOTP({ email, code });
      sessionStorage.setItem('passwordResetToken', response.data.token);
      navigate('/reset-password');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to verify the code.');
    }
  };

  const handleResendOTP = async () => {
    const email = sessionStorage.getItem('passwordResetEmail');
    if (!email) {
      setError('Request a new verification code before continuing.');
      return;
    }
    setIsResending(true);
    setError('');
    setSuccessMessage('');
    try {
      await forgotPassword(email);
      setTimeLeft(600); // Reset timer to 10:00
      setSuccessMessage('A new verification code has been sent to your email.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send a new verification code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeader
        title="Verify your email"
        description="Enter the six-digit code we sent to your email address."
      />
      {error && <div className="auth-error-banner">{error}</div>}
      {successMessage && <div className="auth-success-banner">{successMessage}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <OTPInput value={code} onChange={setCode} error={error} />
        <p className="auth-note">
          {timeLeft > 0 ? (
            <>Code expires in <strong>{formatTime(timeLeft)}</strong>.</>
          ) : (
            <span style={{ color: '#f87171' }}>Code has expired.</span>
          )}{' '}
          Didn't receive it?{' '}
          <button
            className="auth-inline-button"
            type="button"
            onClick={handleResendOTP}
            disabled={isResending}
          >
            {isResending ? 'Sending...' : 'Resend OTP'}
          </button>
        </p>
        <AuthButton type="submit" disabled={timeLeft <= 0}>
          Verify code
        </AuthButton>
      </form>
    </AuthCard>
  );
};

