 // Sticky global navigation with search, context indicators, and user controls.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  FiAlertTriangle,
  FiCloud,
  FiMapPin,
  FiMoon,
  FiSearch,
  FiSun,
} from 'react-icons/fi';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from '../Notification';
import { searchReports } from '../../services/reportService';

import './Navbar.css';

export const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; description?: string | null; status?: string | null; severity?: string | null; address?: string | null; city?: string | null; reporter_name?: string | null; assigned_officer_name?: string | null; image_url?: string | null; }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    let isMounted = true;
    setIsSearching(true);
    setShowResults(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchReports(trimmedQuery, 5);
        if (isMounted) {
          setSearchResults(results);
        }
      } catch (error) {
        if (isMounted) {
          setSearchResults([]);
        }
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const selectedResultId = useMemo(() => searchResults[0]?.id ?? null, [searchResults]);

  const openResult = (reportId: string) => {
    if (!reportId) return;
    setSearchQuery('');
    setShowResults(false);
    navigate(`/report/${reportId}`);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedResultId) {
      openResult(selectedResultId);
      return;
    }
    setShowResults(false);
  };

  const userName = currentUser?.name || 'User';

  const userInitials = userName
    .split(' ')
    .map((name) => name[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <span className="navbar__logo">S</span>

        <div>
          <strong>SafeRoad</strong>
          <small>Making Every Road Safer.</small>
        </div>
      </div>

      <div className="navbar__search-wrapper" ref={searchRef}>
        <form className="navbar__search" onSubmit={handleSearchSubmit}>
          <FiSearch />
          <input
            aria-label="Search SafeRoad"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setShowResults(Boolean(searchQuery.trim()))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && selectedResultId) {
                event.preventDefault();
                openResult(selectedResultId);
              }
            }}
            placeholder="Search reports, roads, people…"
          />
        </form>

        {showResults && (
          <div className="navbar__search-results" role="listbox" aria-label="Search results">
            {isSearching && !searchResults.length ? (
              <div className="navbar__search-empty">Searching…</div>
            ) : searchResults.length ? (
              searchResults.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className="navbar__search-item"
                  onClick={() => openResult(report.id)}
                >
                  <div className="navbar__search-item-title">{report.title}</div>
                  <div className="navbar__search-item-meta">
                    {report.status || 'Reported'}
                    {report.severity ? ` • ${report.severity}` : ''}
                    {report.city ? ` • ${report.city}` : ''}
                  </div>
                </button>
              ))
            ) : (
              <div className="navbar__search-empty">No matching reports</div>
            )}
          </div>
        )}
      </div>

      <div className="navbar__meta">
        <span>
          <FiCloud />
          28°C
        </span>

        <span className="navbar__location">
          <FiMapPin />
          India
        </span>

        <button
          type="button"
          className="icon-button"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === 'light' ? <FiMoon /> : <FiSun />}
        </button>

        <NotificationBell />

        <button type="button" className="emergency-button">
          <FiAlertTriangle />
          Emergency
        </button>

        <button
          type="button"
          className="avatar"
          aria-label="Open profile"
          title={userName}
          onClick={() => navigate('/settings')}
        >
          {userInitials}
        </button>
      </div>
    </header>
  );
};