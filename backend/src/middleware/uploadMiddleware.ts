import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback, MulterError } from 'multer';
import fs from 'fs';
import path from 'path';
import {
  getUploadDirectoryPath,
  generateUniqueFileName,
} from '../utils/fileStorage';
import { AppError } from './errorHandler';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = getUploadDirectoryPath();
      cb(null, uploadDir);
    } catch (error: any) {
      cb(error, '');
    }
  },
  filename: (req, file, cb) => {
    try {
      const fileName = generateUniqueFileName(file.mimetype);
      cb(null, fileName);
    } catch (error: any) {
      cb(error, '');
    }
  },
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid file type. Only JPEG, JPG, PNG, and WEBP images are allowed.',
        400
      )
    );
  }
};

const validateMagicBytes = (filePath: string): boolean => {
  const buffer = Buffer.alloc(12);
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    fd = null;
    if (bytesRead < 4) return false;

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    const isWebp =
      bytesRead >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    return isJpeg || isPng || isWebp;
  } catch {
    if (fd !== null) fs.closeSync(fd);
    return false;
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

export const parseSingleImage = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  uploadFields(req, res, (err: any) => {
    if (err) {
      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError('File size limit exceeded. Maximum size is 10 MB.', 400)
          );
        }
        return next(new AppError(err.message, 400));
      }
      return next(err);
    }

    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;
    const file = files?.image?.[0] || files?.file?.[0];

    if (!file) {
      return next(new AppError('Please upload an image file.', 400));
    }

    if (!validateMagicBytes(file.path)) {
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {}
      }
      return next(
        new AppError(
          'Uploaded file content does not match valid image format magic bytes.',
          400
        )
      );
    }

    req.file = file;
    next();
  });
};
export default parseSingleImage;
