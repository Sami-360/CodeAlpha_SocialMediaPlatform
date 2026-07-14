import crypto from 'crypto';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadsRoot = path.join(projectRoot, 'uploads');
const imageDirectory = path.join(uploadsRoot, 'images');
const videoDirectory = path.join(uploadsRoot, 'videos');

const imageTypes = new Map([
  ['.jpg', ['image/jpeg', 'image/jpg']],
  ['.jpeg', ['image/jpeg', 'image/jpg']],
  ['.png', ['image/png']],
  ['.webp', ['image/webp']],
  ['.gif', ['image/gif']]
]);

const videoTypes = new Map([
  ['.mp4', ['video/mp4', 'application/mp4']],
  ['.webm', ['video/webm']],
  ['.mov', ['video/quicktime', 'video/x-quicktime', 'video/mov', 'video/mp4']]
]);

const getValidatedType = (file, allowVideo) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const acceptedTypes = imageTypes.get(extension) || (allowVideo ? videoTypes.get(extension) : null);
  if (!acceptedTypes || !acceptedTypes.includes(file.mimetype.toLowerCase())) return null;
  return { extension, mediaType: imageTypes.has(extension) ? 'image' : 'video' };
};

const createFileFilter = (allowVideo) => (_req, file, callback) => {
  const validated = getValidatedType(file, allowVideo);
  if (!validated) {
    const error = new Error(
      allowVideo
        ? 'Unsupported media format. Use JPG, JPEG, PNG, WEBP, GIF, MP4, WEBM, or MOV.'
        : 'Unsupported profile image format. Use JPG, JPEG, PNG, WEBP, or GIF.'
    );
    error.status = 400;
    return callback(error);
  }
  file.validatedMediaType = validated.mediaType;
  file.validatedExtension = validated.extension;
  return callback(null, true);
};

const storage = multer.diskStorage({
  destination: (_req, file, callback) => {
    callback(null, file.validatedMediaType === 'video' ? videoDirectory : imageDirectory);
  },
  filename: (_req, file, callback) => {
    callback(null, `${Date.now()}-${crypto.randomUUID()}${file.validatedExtension}`);
  }
});

export const uploadPostMedia = multer({
  storage,
  fileFilter: createFileFilter(true),
  limits: { files: 1, fileSize: 25 * 1024 * 1024 }
});

export const uploadProfilePicture = multer({
  storage,
  fileFilter: createFileFilter(false),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 }
});

export const mediaUrlForFile = (file) => (
  file ? `/uploads/${file.validatedMediaType === 'video' ? 'videos' : 'images'}/${file.filename}` : ''
);

export const deleteUploadedFile = async (mediaUrl) => {
  if (typeof mediaUrl !== 'string' || !mediaUrl.startsWith('/uploads/')) return;
  const relativePath = mediaUrl.replace(/^\/+/, '');
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) return;
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

export const cleanupRequestFile = async (req) => {
  if (req.file) await deleteUploadedFile(mediaUrlForFile(req.file));
};
