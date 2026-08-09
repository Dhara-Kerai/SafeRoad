// Shared navigation actions for wizard steps.
interface Props { currentStep: number; onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; }
export const ProgressButtons = ({ currentStep, onBack, onNext, nextLabel = 'Continue', nextDisabled = false }: Props) => <div className="wizard-actions">{currentStep > 1 && <button type="button" className="button-secondary" onClick={onBack} disabled={nextDisabled}>Back</button>}<button type="button" className="button-primary" onClick={onNext} disabled={nextDisabled}>{nextDisabled ? 'Submitting…' : nextLabel}</button></div>;
