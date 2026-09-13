import { type FormEvent, useEffect, useState } from 'react';
import { FiCheckCircle, FiLogOut, FiLock, FiUser } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { changePassword, updateProfile } from '../../services/authService';

import './Settings.css';

const roleLabels = {
  citizen: 'Citizen',
  municipal_officer: 'Municipal Officer',
  admin: 'Administrator',
} as const;

export const Settings = () => {
  const navigate = useNavigate();
  const { currentUser, isLoading: isAuthLoading, updateCurrentUser, logout } = useAuth();
  const [name, setName] = useState(currentUser?.name || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
    }
  }, [currentUser]);

  if (isAuthLoading || !currentUser) {
    return (
      <main className="settings-page" aria-live="polite">
        <div className="settings-state">Loading account settings...</div>
      </main>
    );
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    setProfileMessage('');
    setProfileError('');

    if (trimmedName.length < 2) {
      setProfileError('Name must be at least 2 characters.');
      return;
    }

    setProfileLoading(true);
    try {
      const response = await updateProfile(trimmedName);
      const user = response.data.user;
      updateCurrentUser({ name: user.fullName, email: user.email });
      setName(user.fullName);
      setProfileMessage('Profile updated successfully.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to update your profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation must match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password changed successfully.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Unable to change your password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const confirmLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <div>
          <p className="settings-page__eyebrow">ACCOUNT</p>
          <h1>Settings</h1>
          <p>Manage your SafeRoad account and security.</p>
        </div>
      </header>

      <section className="settings-section" aria-labelledby="account-heading">
        <div className="settings-section__heading">
          <FiUser aria-hidden="true" />
          <div>
            <h2 id="account-heading">Account</h2>
            <p>Review your account details and update your name.</p>
          </div>
        </div>

        <div className="settings-grid">
          <article className="settings-panel">
            <h3>Profile</h3>
            <dl className="settings-profile-list">
              <div><dt>Name</dt><dd>{currentUser.name}</dd></div>
              <div><dt>Email</dt><dd>{currentUser.email}</dd></div>
              <div><dt>Role</dt><dd>{roleLabels[currentUser.role]}</dd></div>
            </dl>
          </article>

          <form className="settings-panel settings-form" onSubmit={handleProfileSubmit}>
            <h3>Edit Profile</h3>
            <label htmlFor="settings-name">Name</label>
            <input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={100}
              autoComplete="name"
              disabled={profileLoading}
            />
            <p className="settings-help">Email and role are managed by the account system.</p>
            {profileMessage && <p className="settings-message settings-message--success" role="status"><FiCheckCircle />{profileMessage}</p>}
            {profileError && <p className="settings-message settings-message--error" role="alert">{profileError}</p>}
            <button type="submit" className="settings-button" disabled={profileLoading}>
              {profileLoading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="security-heading">
        <div className="settings-section__heading">
          <FiLock aria-hidden="true" />
          <div>
            <h2 id="security-heading">Security</h2>
            <p>Keep your account credentials up to date.</p>
          </div>
        </div>

        <div className="settings-grid">
          <form className="settings-panel settings-form" onSubmit={handlePasswordSubmit}>
            <h3>Change Password</h3>
            <label htmlFor="current-password">Current Password</label>
            <input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" disabled={passwordLoading} />
            <label htmlFor="new-password">New Password</label>
            <input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} maxLength={100} autoComplete="new-password" disabled={passwordLoading} />
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} maxLength={100} autoComplete="new-password" disabled={passwordLoading} />
            <p className="settings-help">Passwords must be at least 6 characters.</p>
            {passwordMessage && <p className="settings-message settings-message--success" role="status"><FiCheckCircle />{passwordMessage}</p>}
            {passwordError && <p className="settings-message settings-message--error" role="alert">{passwordError}</p>}
            <button type="submit" className="settings-button" disabled={passwordLoading}>
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>

          <article className="settings-panel settings-panel--action">
            <h3>Logout</h3>
            <p>End this session on this device.</p>
            <button type="button" className="settings-button settings-button--secondary" onClick={() => setShowLogoutConfirmation(true)}>
              <FiLogOut /> Logout
            </button>
          </article>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="notifications-heading">
        <div className="settings-section__heading">
          <FiCheckCircle aria-hidden="true" />
          <div>
            <h2 id="notifications-heading">Notifications</h2>
            <p>Review the notifications currently supported by your account.</p>
          </div>
        </div>
        <article className="settings-panel settings-notification-note">
          <h3>Notification Preferences</h3>
          <p>SafeRoad currently delivers report, assignment, status, comment, and system notifications through the Notifications center. Individual preference storage is not available in the current backend.</p>
          <Link className="settings-button settings-button--link" to="/notifications">Open Notifications</Link>
        </article>
      </section>

      {showLogoutConfirmation && (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="logout-heading">
            <h2 id="logout-heading">Log out of SafeRoad?</h2>
            <p>Your current session will be ended.</p>
            <div className="settings-modal__actions">
              <button type="button" className="settings-button settings-button--secondary" onClick={() => setShowLogoutConfirmation(false)}>Cancel</button>
              <button type="button" className="settings-button settings-button--danger" onClick={confirmLogout}>Confirm Logout</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Settings;
