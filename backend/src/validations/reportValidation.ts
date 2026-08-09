import { z } from 'zod';
import { ReportStatus, Severity } from '@prisma/client';

const reportImageUrlSchema = z.string().regex(
  /^\/uploads\/reports\/\d{4}\/\d{2}\/[A-Za-z0-9-]+\.(?:jpe?g|png|webp)$/i,
  'Image must reference an uploaded report image'
);

export const createReportSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  severity: z.nativeEnum(Severity).optional(),
  imageUrl: reportImageUrlSchema.optional(),
});

export const updateReportSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  severity: z.nativeEnum(Severity).optional(),
  status: z.nativeEnum(ReportStatus).optional(),
  departmentId: z.string().nullable().optional(),
  officerId: z.string().nullable().optional(),
  imageUrl: reportImageUrlSchema.optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
