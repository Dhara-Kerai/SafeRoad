import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roadTypes, severityLevels, trafficLevels } from '../../data/reportWizard';
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
      if (!report.location.roadName.trim() || !report.location.area.trim()) {
        setValidationMessage('Please fill in the road name and area before continuing.');
        return;
      }
      setValidationMessage('');
    }
    if (currentStep === 3 && (!report.description || !report.roadType || !report.severity || !report.traffic)) return;
    if (currentStep === 5) {
      await submitReport(report);
      navigate('/report-success');
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  return <main className="report-wizard">
    <header><p className="eyebrow">CITIZEN REPORTING</p><h1>Report a New Pothole</h1><p>Help improve road safety by reporting road damage.</p></header>
    <WizardStepper currentStep={currentStep} />
    {currentStep === 1 && <UploadCard image={report.image} onImage={(image) => updateReport({ image })} />}
    {currentStep === 2 && <section className="report-card report-form"><h2>Location details</h2><p>{geoMessage}</p>{geoStatus !== 'loading' && <button type="button" className="button-secondary" onClick={() => { void requestLocation(); }}>Retry location</button>}{validationMessage ? <p role="alert">{validationMessage}</p> : null}{(['latitude', 'longitude', 'roadName', 'area', 'city', 'landmark'] as const).map((field) => <label key={field}>{field.replace(/([A-Z])/g, ' $1')}<input value={report.location[field]} onChange={(event) => { setValidationMessage(''); updateReport({ location: { ...report.location, [field]: event.target.value } }); }} /></label>)}</section>}
    {currentStep === 3 && <section className="report-card report-form"><h2>Road damage details</h2><label>Description<textarea value={report.description} maxLength={500} onChange={(event) => updateReport({ description: event.target.value })} /></label><small>{report.description.length}/500</small><label>Road type<select value={report.roadType} onChange={(event) => updateReport({ roadType: event.target.value as typeof report.roadType })}><option value="">Select road type</option>{roadTypes.map((value) => <option key={value}>{value}</option>)}</select></label><div className="choice-grid">{severityLevels.map((value) => <button type="button" key={value} className={report.severity === value ? 'selected' : ''} onClick={() => updateReport({ severity: value })}>{value}</button>)}</div><label>Traffic level<select value={report.traffic} onChange={(event) => updateReport({ traffic: event.target.value as typeof report.traffic })}><option value="">Select traffic level</option>{trafficLevels.map((value) => <option key={value}>{value}</option>)}</select></label><label>Optional notes<textarea value={report.notes} onChange={(event) => updateReport({ notes: event.target.value })} /></label></section>}
    {currentStep === 4 && <section className="report-card ai-result"><h2>AI road damage analysis</h2><p>Your uploaded image will be analyzed by the SafeRoad YOLO model immediately after submission.</p><p>The real stored detection, confidence, and severity will appear in Report Details.</p></section>}
    {currentStep === 5 && <ReviewCard report={report} />}
    <ProgressButtons currentStep={currentStep} onBack={() => setCurrentStep(currentStep - 1)} onNext={next} nextLabel={currentStep === 5 ? 'Submit Report' : 'Continue'} />
  </main>;
};
