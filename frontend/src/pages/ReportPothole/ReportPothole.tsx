import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roadTypes, severityLevels, trafficLevels } from '../../data/reportWizard';
import { getCitiesForState, INDIAN_STATES } from '../../data/indianLocations';
import { useReport } from '../../context/ReportContext';
import { getLocation, submitReport } from '../../services/reportService';
import { ProgressButtons } from '../../components/report/ProgressButtons';
import { ReviewCard } from '../../components/report/ReviewCard';
import { UploadCard } from '../../components/report/UploadCard';
import { WizardStepper } from '../../components/report/WizardStepper';
import './ReportPothole.css';

export const ReportPothole = () => {
  const { currentStep, report, setCurrentStep, updateReport } = useReport();
  const navigate = useNavigate();
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'denied' | 'unsupported' | 'unavailable'>('idle');
  const [geoMessage, setGeoMessage] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestLocation = useCallback(async () => {
    setGeoStatus('loading');
    setGeoMessage('Detecting your location...');
    const result = await getLocation();
    if (result.status === 'success' && result.latitude !== undefined && result.longitude !== undefined) {
      updateReport({ location: { ...report.location, latitude: String(result.latitude), longitude: String(result.longitude) } });
      setGeoStatus('success');
      setGeoMessage(result.message || 'Location detected successfully.');
      return;
    }
    setGeoStatus(result.status);
    setGeoMessage(result.message || 'Unable to detect your location right now.');
  }, [report.location, updateReport]);

  useEffect(() => {
    if (currentStep === 2 && geoStatus === 'idle') void requestLocation();
  }, [currentStep, geoStatus, requestLocation]);

  const next = async () => {
    if (currentStep === 1 && !report.image) return;
    if (currentStep === 2) {
      if (!report.location.state?.trim()) {
        setValidationMessage('Please select a State / Union Territory before continuing.');
        return;
      }
      if (!report.location.city?.trim()) {
        setValidationMessage('Please select a City before continuing.');
        return;
      }
      if (!report.location.roadName?.trim()) {
        setValidationMessage('Please fill in the Road Name before continuing.');
        return;
      }
      if (!report.location.area?.trim()) {
        setValidationMessage('Please fill in the Area before continuing.');
        return;
      }
      const latStr = String(report.location.latitude ?? '').trim();
      const lngStr = String(report.location.longitude ?? '').trim();
      const latitude = Number(latStr);
      const longitude = Number(lngStr);
      if (!latStr || !lngStr || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setValidationMessage('Please detect your location or enter valid latitude and longitude coordinates before continuing.');
        return;
      }
      setValidationMessage('');
    }
    if (currentStep === 3 && (!report.description || !report.roadType || !report.severity || !report.traffic)) return;
    if (currentStep === 5) {
      setSubmitting(true);
      try {
        const submittedReport = await submitReport(report);
        navigate('/report-success', { state: { reportId: submittedReport.id } });
      } catch (error) {
        setValidationMessage(error instanceof Error ? error.message : 'Unable to submit the report. Please try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  const availableCities = getCitiesForState(report.location.state || '');

  return (
    <main className="report-wizard">
      <header>
        <p className="eyebrow">CITIZEN REPORTING</p>
        <h1>Report a New Pothole</h1>
        <p>Help improve road safety by reporting road damage.</p>
      </header>
      <WizardStepper currentStep={currentStep} />
      {currentStep === 1 && <UploadCard image={report.image} imagePreview={report.imagePreview} onImage={(image, imagePreview) => updateReport({ image, imagePreview })} />}
      {currentStep === 2 && (
        <section className="report-card report-form">
          <h2>Location details</h2>
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{geoMessage}</p>
          {geoStatus !== 'loading' && (
            <button type="button" className="button-secondary" onClick={() => { void requestLocation(); }}>
              Detect / Retry location
            </button>
          )}
          {validationMessage ? <p role="alert" className="auth-error-banner" style={{ margin: '12px 0 0' }}>{validationMessage}</p> : null}

          <label htmlFor="state-select">
            State / Union Territory *
            <select
              id="state-select"
              value={report.location.state || ''}
              onChange={(event) => {
                setValidationMessage('');
                const newState = event.target.value;
                updateReport({
                  location: {
                    ...report.location,
                    state: newState,
                    city: '',
                  },
                });
              }}
            >
              <option value="">Select State / Union Territory</option>
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </label>

          <label htmlFor="city-select">
            City *
            <select
              id="city-select"
              disabled={!report.location.state}
              value={report.location.city || ''}
              onChange={(event) => {
                setValidationMessage('');
                updateReport({
                  location: {
                    ...report.location,
                    city: event.target.value,
                  },
                });
              }}
            >
              <option value="">
                {report.location.state ? 'Select City' : 'Select State first'}
              </option>
              {availableCities.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </label>

          <label htmlFor="road-name-input">
            Road Name *
            <input
              id="road-name-input"
              placeholder="e.g. Ring Road, MG Road"
              value={report.location.roadName}
              onChange={(event) => {
                setValidationMessage('');
                updateReport({
                  location: { ...report.location, roadName: event.target.value },
                });
              }}
            />
          </label>

          <label htmlFor="area-input">
            Area / Sector / Colony *
            <input
              id="area-input"
              placeholder="e.g. Indiranagar, Connaught Place"
              value={report.location.area}
              onChange={(event) => {
                setValidationMessage('');
                updateReport({
                  location: { ...report.location, area: event.target.value },
                });
              }}
            />
          </label>

          <label htmlFor="landmark-input">
            Landmark (Optional)
            <input
              id="landmark-input"
              placeholder="e.g. Near Metro Station"
              value={report.location.landmark}
              onChange={(event) => {
                setValidationMessage('');
                updateReport({
                  location: { ...report.location, landmark: event.target.value },
                });
              }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label htmlFor="lat-input">
              Latitude
              <input
                id="lat-input"
                value={report.location.latitude}
                placeholder="e.g. 28.6139"
                onChange={(event) => {
                  setValidationMessage('');
                  updateReport({
                    location: { ...report.location, latitude: event.target.value },
                  });
                }}
              />
            </label>

            <label htmlFor="lng-input">
              Longitude
              <input
                id="lng-input"
                value={report.location.longitude}
                placeholder="e.g. 77.2090"
                onChange={(event) => {
                  setValidationMessage('');
                  updateReport({
                    location: { ...report.location, longitude: event.target.value },
                  });
                }}
              />
            </label>
          </div>
        </section>
      )}
      {currentStep === 3 && (
        <section className="report-card report-form">
          <h2>Road damage details</h2>
          <label>Description<textarea value={report.description} maxLength={500} onChange={(event) => updateReport({ description: event.target.value })} /></label>
          <small>{report.description.length}/500</small>
          <label>Road type<select value={report.roadType} onChange={(event) => updateReport({ roadType: event.target.value as typeof report.roadType })}><option value="">Select road type</option>{roadTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
          <div className="choice-grid">{severityLevels.map((value) => <button type="button" key={value} className={report.severity === value ? 'selected' : ''} onClick={() => updateReport({ severity: value })}>{value}</button>)}</div>
          <label>Traffic level<select value={report.traffic} onChange={(event) => updateReport({ traffic: event.target.value as typeof report.traffic })}><option value="">Select traffic level</option>{trafficLevels.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Optional notes<textarea value={report.notes} onChange={(event) => updateReport({ notes: event.target.value })} /></label>
        </section>
      )}
      {currentStep === 4 && (
        <section className="report-card ai-result">
          <h2>AI road damage analysis</h2>
          <p>Your uploaded image will be analyzed by the SafeRoad YOLO model immediately after submission.</p>
          <p>The real stored detection, confidence, and severity will appear in Report Details.</p>
        </section>
      )}
      {currentStep === 5 && <ReviewCard report={report} />}
      <ProgressButtons currentStep={currentStep} onBack={() => setCurrentStep(currentStep - 1)} onNext={next} nextLabel={currentStep === 5 ? 'Submit Report' : 'Continue'} nextDisabled={submitting} />
    </main>
  );
};
