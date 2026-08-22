import type { ReactNode } from 'react';
import { FiShield } from 'react-icons/fi';
import { AuthBackground } from '../components/auth/AuthBackground';

import '../components/auth/Auth.css';
import './AuthLayout.css';

interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="auth-layout">
      {/* Full-Screen Dark Cinematic Road Background */}
      <AuthBackground />

      {/* Centered Single-Column Container */}
      <div className="auth-layout__content">
        {/* Minimal SafeRoads Header */}
        <header className="auth-layout__branding">
          <span className="auth-layout__logo">
            <FiShield size={24} />
          </span>
          <div className="auth-layout__title-group">
            <h1 className="auth-layout__brand-name">SafeRoads</h1>
            <p className="auth-layout__tagline">Smarter roads. Safer journeys.</p>
          </div>
        </header>

        {/* Centered Glass Authentication Card Wrapper */}
        <main className="auth-layout__card-wrapper">{children}</main>
      </div>
    </div>
  );
};
