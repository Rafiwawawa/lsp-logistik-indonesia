// middleware/imageProcessor.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const MAX_SIZE = 5 * 1024 * 1024; // 5 MiB
const MAX_DIMENSION = 5000; // max width/height
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_CATEGORIES = [
  'berita',
  'pengurus',
  'galeri',
];

function getUploadRoot() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, '..', 'uploads');
}

function getCategoryUploadDir(category) {
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new Error('Invalid upload category');
  }

  const root = getUploadRoot();
  const dir = path.resolve(root, category);

  if (!dir.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid upload path');
  }

  return dir;
}

function createMulterForCategory(category) {
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new Error('Invalid upload category');
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const uploadDir = getCategoryUploadDir(category);

        fs.mkdirSync(uploadDir, {
          recursive: true,
        });

        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },

    filename: (req, file, cb) => {
      const ext = path
        .extname(file.originalname)
        .toLowerCase();

      const safeExt =
        ALLOWED_EXTS.includes(ext)
          ? ext
          : '';

      cb(
        null,
        crypto.randomUUID() + safeExt
      );
    },
  });

  return multer({
    storage,

    limits: {
      fileSize: MAX_SIZE,   // 5 MiB per file
      files: 1,             // only one file per request
      fields: 10,           // max text fields per form
      parts: 11,            // total parts (fields + files)
      fieldSize: 64 * 1024, // 64 KiB per text field
    },

    fileFilter: (req, file, cb) => {
      const ext = path
        .extname(file.originalname)
        .toLowerCase();

      if (!ALLOWED_EXTS.includes(ext)) {
        return cb(
          new Error(
            'Unsupported file extension'
          )
        );
      }

      cb(null, true);
    },
  });
}

async function processImage(filePath) {
  let tmp;

  try {
    const buffer = await fs.promises.readFile(filePath);

    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(buffer);

    // Validate actual file content / magic bytes
    if (
      !type ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)
    ) {
      const err = new Error('Format gambar tidak didukung');
      err.status = 415;
      err.code = 'UNSUPPORTED_IMAGE_TYPE';
      throw err;
    }

    // Ensure file extension matches detected file content
    const fileExt = path.extname(filePath).toLowerCase();

    const validDetectedExtensions =
      type.mime === 'image/jpeg'
        ? ['.jpg', '.jpeg']
        : [`.${type.ext}`];

    if (!validDetectedExtensions.includes(fileExt)) {
      const err = new Error('Ekstensi file tidak sesuai dengan isi gambar');
      err.status = 415;
      err.code = 'IMAGE_EXTENSION_MISMATCH';
      throw err;
    }

    const img = sharp(buffer);
    let meta;

    try {
      meta = await img.metadata();
    } catch (error) {
      const err = new Error('File gambar rusak atau tidak dapat dibaca');
      err.status = 400;
      err.code = 'INVALID_IMAGE_DATA';
      throw err;
    }

    // Reject animated WebP
    if (
      type.mime === 'image/webp' &&
      meta.pages &&
      meta.pages > 1
    ) {
      const err = new Error('Animated WebP tidak diperbolehkan');
      err.status = 400;
      err.code = 'ANIMATED_WEBP_NOT_ALLOWED';
      throw err;
    }

    // Dimension safety limit
    if (
      meta.width > MAX_DIMENSION ||
      meta.height > MAX_DIMENSION
    ) {
      const err = new Error('Dimensi gambar melebihi batas');
      err.status = 400;
      err.code = 'IMAGE_DIMENSIONS_EXCEEDED';
      throw err;
    }

    // Re-encode + auto orientation.
    // No withMetadata() = metadata stripped.
    const processed = await img
      .rotate()
      .toFormat(type.ext)
      .toBuffer();

    tmp = `${filePath}.tmp`;

    await fs.promises.writeFile(tmp, processed);
    await fs.promises.rename(tmp, filePath);

  } catch (e) {
    // Remove original uploaded file after failed processing
    await fs.promises.unlink(filePath).catch(() => {});

    // Also remove temporary file if processing failed midway
    if (tmp) {
      await fs.promises.unlink(tmp).catch(() => {});
    }

    throw e;
  }
}

module.exports = { createMulterForCategory, processImage };