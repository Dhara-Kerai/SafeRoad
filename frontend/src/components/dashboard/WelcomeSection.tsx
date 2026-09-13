// Dashboard greeting and primary report action.

import { FiPlus } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

export const WelcomeSection = () => {
  const { currentUser, isLoading } = useAuth();

  const today = new Date();

  const dateText = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const timeText = today.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const userName = currentUser?.name || 'User';

  if (isLoading) {
    return null;
  }

  return (
    <section className="welcome">
      <div>
        <p className="eyebrow">
          {dateText.toUpperCase()} · {timeText}
        </p>

        <h1>
          Good morning, {userName} <span>👋</span>
        </h1>

        <p>
          Help make roads safer by reporting potholes and tracking road
          conditions in your area.
        </p>
      </div>

      <Link to="/report-pothole" className="primary-action">
        <FiPlus />
        Report Pothole
      </Link>
    </section>
  );
};