import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

const AI_SERVICE_URL = env.AI_SERVICE_URL;
const REPORT_UPLOADS_DIRECTORY = path.resolve(process.cwd(), 'uploads', 'reports');

const resolveReportImagePath = (imageUrl: string): string => {
  const relativePath = imageUrl.replace(/^\/+/, '');
  const localPath = path.resolve(process.cwd(), relativePath);
  const relativeToUploads = path.relative(REPORT_UPLOADS_DIRECTORY, localPath);

  if (
    !imageUrl.startsWith('/uploads/reports/') ||
    relativeToUploads.startsWith('..') ||
    path.isAbsolute(relativeToUploads)
  ) {
    throw new AppError('Invalid report image reference', 400);
  }

  return localPath;
};

interface AIDetectionResult {
  class_name: string;
  confidence: number;
  box: number[];
  center: number[];
  severity: string;
}

interface AIResponse {
  success: boolean;
  processing_time: number;
  width: number;
  height: number;
  total_detections: number;
  detections: AIDetectionResult[];
  annotated_image_path: string | null;
  error: string | null;
}

export const analyzeReportImage = async (
  reportId: string,
  imageUrl: string
): Promise<any | null> => {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const localPath = resolveReportImagePath(imageUrl);

    if (!fs.existsSync(localPath)) {
      console.warn(`[AI Service Integration] File not found at ${localPath}`);
      return null;
    }

    const fileBuffer = await fs.promises.readFile(localPath);
    const ext = path.extname(localPath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';

    const blob = new Blob([fileBuffer], { type: mimeType });
    const formData = new FormData();
    formData.append('image', blob, path.basename(localPath));

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds

    console.log(
      `[AI Service Integration] Sending image to AI service at ${AI_SERVICE_URL}...`
    );
    const response = await fetch(`${AI_SERVICE_URL}/api/detection/detect`, {
      method: 'POST',
      headers: {
        'X-Internal-Api-Key': env.AI_INTERNAL_API_KEY,
      },
      body: formData,
      signal: controller.signal,
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `[AI Service Integration] AI service returned error status ${response.status}: ${errText}`
      );
      return null;
    }

    const aiData = (await response.json()) as AIResponse;

    if (!aiData.success) {
      console.warn(
        `[AI Service Integration] AI inference failed: ${aiData.error}`
      );
      return null;
    }

    const potholeDetected = aiData.total_detections > 0;
    const sortedDetections = [...aiData.detections].sort(
      (a, b) => b.confidence - a.confidence
    );
    const primaryDetection = sortedDetections[0];
    const confidenceScore = primaryDetection ? primaryDetection.confidence : 0.0;

    const detailsObj = {
      totalDetections: aiData.total_detections,
      imageWidth: aiData.width,
      imageHeight: aiData.height,
      annotatedImagePath: aiData.annotated_image_path,
      detections: sortedDetections.map((d) => ({
        className: d.class_name,
        confidence: d.confidence,
        box: d.box,
        center: d.center,
        severity: d.severity,
      })),
      primarySeverity: primaryDetection ? primaryDetection.severity : 'Low',
      modelVersion: 'YOLOv8-best',
    };

    const aiResult = await prisma.aIResult.create({
      data: {
        reportId,
        potholeDetected,
        confidenceScore,
        details: JSON.stringify(detailsObj),
      },
    });

    console.log(
      `[AI Service Integration] Stored AIResult for report ${reportId} successfully.`
    );
    return aiResult;
  } catch (error: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (error.name === 'AbortError') {
      console.error(
        '[AI Service Integration] Request to AI service timed out after 10 seconds.'
      );
    } else {
      console.error(
        '[AI Service Integration] Failed to integrate with AI service:',
        error.message
      );
    }
    return null;
  }
};
