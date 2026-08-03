const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

const COURSE_STORAGE_ROOT = path.join(process.cwd(), 'storage', 'course');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFilename(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const base = crypto.randomBytes(16).toString('hex');
  return `${base}${ext}`;
}

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.has(ext);

  if (!mimeOk || !extOk) {
    return cb(
      AppError.create(
        'Invalid file type. Only JPG, JPEG, PNG, and PDF files are allowed.',
        400,
        httpstatustext.FAIL
      ),
      false
    );
  }

  const lower = (file.originalname || '').toLowerCase();
  if (/\.(exe|bat|cmd|sh|js|msi|dll|com|scr)(\.|$)/i.test(lower)) {
    return cb(
      AppError.create('Executable files are not allowed.', 400, httpstatustext.FAIL),
      false
    );
  }

  cb(null, true);
}

function createCourseUploader(subfolder) {
  const destination = path.join(COURSE_STORAGE_ROOT, subfolder);
  ensureDir(destination);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDir(destination);
      cb(null, destination);
    },
    filename: (_req, file, cb) => {
      cb(null, sanitizeFilename(file.originalname));
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter,
  });
}

/**
 * Registration upload: verificationDocument → documents/,
 * participantDocuments → participants/
 */
const registrationStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const sub =
      file.fieldname === 'participantDocuments' ? 'participants' : 'documents';
    const destination = path.join(COURSE_STORAGE_ROOT, sub);
    ensureDir(destination);
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

const uploadRegistrationFiles = multer({
  storage: registrationStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

function toStorageKey(absolutePath) {
  if (!absolutePath) return null;
  const relative = path.relative(process.cwd(), absolutePath);
  return relative.split(path.sep).join('/');
}

function resolveStorageKey(storageKey) {
  if (!storageKey || typeof storageKey !== 'string') {
    throw AppError.create('Invalid file path', 400, httpstatustext.FAIL);
  }

  const normalized = storageKey.replace(/\\/g, '/');
  if (normalized.includes('..') || !normalized.startsWith('storage/course/')) {
    throw AppError.create('Unauthorized file path', 403, httpstatustext.FAIL);
  }

  const absolute = path.join(process.cwd(), ...normalized.split('/'));
  if (!absolute.startsWith(COURSE_STORAGE_ROOT)) {
    throw AppError.create('Unauthorized file path', 403, httpstatustext.FAIL);
  }

  return absolute;
}

module.exports = {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  COURSE_STORAGE_ROOT,
  createCourseUploader,
  uploadRegistrationFiles,
  toStorageKey,
  resolveStorageKey,
  uploadVerificationDoc: createCourseUploader('documents'),
  uploadReceipt: createCourseUploader('receipts'),
  uploadParticipantDoc: createCourseUploader('participants'),
};
