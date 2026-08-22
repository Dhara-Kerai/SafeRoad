-- Complete the existing repair workflow with the admin-owned final-review stages.
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'QUALITY_CHECK';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
