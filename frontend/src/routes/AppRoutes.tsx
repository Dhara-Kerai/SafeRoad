// Central route configuration for public and protected SafeRoad pages.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthLayout } from '../layouts/AuthLayout';
import { MainLayout } from '../layouts/MainLayout';
import { Dashboard } from '../pages/Dashboard';
import { ReportPothole } from '../pages/ReportPothole';
import { ReportSuccess } from '../pages/ReportSuccess';
import { MyReports } from '../pages/MyReports';
import { AIDetection } from '../pages/AIDetection';
import { ReportDetails } from '../pages/ReportDetails';
import { Notifications } from '../pages/Notifications';
import { ForgotPassword } from '../pages/ForgotPassword';
import { Login } from '../pages/Login';
import { NotFound } from '../pages/NotFound';
import { Register } from '../pages/Register';
import { ResetPassword } from '../pages/ResetPassword';
import { VerifyOTP } from '../pages/VerifyOTP';

import { ProtectedRoute } from './ProtectedRoute';
import { ReportProvider } from '../context/ReportContext';
import { OfficerDashboard } from '../pages/OfficerDashboard';
import { Settings } from '../pages/Settings';

const withAuthLayout = (page: React.ReactNode) => <AuthLayout>{page}</AuthLayout>;
const LiveMap = lazy(() => import('../pages/LiveMap').then(({ LiveMap: Page }) => ({ default: Page })));
const Analytics = lazy(() => import('../pages/Analytics').then(({ Analytics: Page }) => ({ default: Page })));
const Admin = lazy(() => import('../pages/Admin').then(({ Admin: Page }) => ({ default: Page })));
const withWorkspacePage = (page: React.ReactNode) => <ProtectedRoute><MainLayout><Suspense fallback={<main aria-live="polite">Loading workspace…</main>}>{page}</Suspense></MainLayout></ProtectedRoute>;

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={withAuthLayout(<Login />)} />
        <Route path="/login" element={withAuthLayout(<Login />)} />
        <Route path="/register" element={withAuthLayout(<Register />)} />
        <Route path="/forgot-password" element={withAuthLayout(<ForgotPassword />)} />
        <Route path="/verify-otp" element={withAuthLayout(<VerifyOTP />)} />
        <Route path="/reset-password" element={withAuthLayout(<ResetPassword />)} />
        <Route path="/dashboard" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/officer-dashboard" element={<ProtectedRoute allowedRoles={['municipal_officer']}><MainLayout><OfficerDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/officer" element={<ProtectedRoute allowedRoles={['municipal_officer']}><MainLayout><OfficerDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/officer/reports" element={<ProtectedRoute allowedRoles={['municipal_officer']}><MainLayout><MyReports /></MainLayout></ProtectedRoute>} />
        <Route path="/officer/reports/:reportId" element={<ProtectedRoute allowedRoles={['municipal_officer']}><MainLayout><ReportDetails /></MainLayout></ProtectedRoute>} />
        <Route path="/live-map" element={withWorkspacePage(<LiveMap />)} />
        <Route path="/analytics" element={withWorkspacePage(<Analytics />)} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><MainLayout><Admin /></MainLayout></ProtectedRoute>} />
        <Route path="/report-pothole" element={<ProtectedRoute><MainLayout><ReportProvider><ReportPothole /></ReportProvider></MainLayout></ProtectedRoute>} />
        <Route path="/report-success" element={<ProtectedRoute><MainLayout><ReportProvider><ReportSuccess /></ReportProvider></MainLayout></ProtectedRoute>} />
        <Route path="/ai-detection" element={<ProtectedRoute allowedRoles={['citizen', 'municipal_officer', 'admin']}><MainLayout><AIDetection /></MainLayout></ProtectedRoute>} />
        <Route path="/my-reports" element={<ProtectedRoute><MainLayout><MyReports /></MainLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><MainLayout><MyReports /></MainLayout></ProtectedRoute>} />
        <Route path="/report/:reportId" element={<ProtectedRoute><MainLayout><ReportDetails /></MainLayout></ProtectedRoute>} />
        <Route path="/reports/:reportId" element={<ProtectedRoute><MainLayout><ReportDetails /></MainLayout></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><MainLayout><Notifications /></MainLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};
