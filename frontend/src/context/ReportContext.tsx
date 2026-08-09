// Temporary wizard state, structured for a future report draft API.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { mockLocation } from '../data/reportWizard';
import type { ReportRequest } from '../types/Report';
const initialReport: ReportRequest = { image: null, location: mockLocation, description: '', roadType: '', severity: '', traffic: '', notes: '' };
interface ReportContextValue { currentStep: number; report: ReportRequest; setCurrentStep: (step: number) => void; updateReport: (values: Partial<ReportRequest>) => void; resetReport: () => void; }
const ReportContext = createContext<ReportContextValue | undefined>(undefined);
export const ReportProvider = ({ children }: { children: ReactNode }) => { const [currentStep, setCurrentStep] = useState(1); const [report, setReport] = useState(initialReport); const updateReport = (values: Partial<ReportRequest>) => setReport((current) => ({ ...current, ...values })); const resetReport = () => { setCurrentStep(1); setReport(initialReport); }; return <ReportContext.Provider value={{ currentStep, report, setCurrentStep, updateReport, resetReport }}>{children}</ReportContext.Provider>; };
// eslint-disable-next-line react-refresh/only-export-components
export const useReport = () => { const context = useContext(ReportContext); if (!context) throw new Error('useReport must be used within ReportProvider'); return context; };
