// In-memory state for the report creation wizard.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { emptyLocation } from '../data/reportWizard';
import type { ReportRequest } from '../types/Report';
const createInitialReport = (): ReportRequest => ({ image: null, imagePreview: null, location: { ...emptyLocation }, description: '', roadType: '', severity: '', traffic: '', notes: '' });
interface ReportContextValue { currentStep: number; report: ReportRequest; setCurrentStep: (step: number) => void; updateReport: (values: Partial<ReportRequest>) => void; resetReport: () => void; }
const ReportContext = createContext<ReportContextValue | undefined>(undefined);
export const ReportProvider = ({ children }: { children: ReactNode }) => { const [currentStep, setCurrentStep] = useState(1); const [report, setReport] = useState(createInitialReport); const updateReport = (values: Partial<ReportRequest>) => setReport((current) => ({ ...current, ...values })); const resetReport = () => { setCurrentStep(1); setReport(createInitialReport()); }; return <ReportContext.Provider value={{ currentStep, report, setCurrentStep, updateReport, resetReport }}>{children}</ReportContext.Provider>; };
// eslint-disable-next-line react-refresh/only-export-components
export const useReport = () => { const context = useContext(ReportContext); if (!context) throw new Error('useReport must be used within ReportProvider'); return context; };
