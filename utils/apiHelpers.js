const fs = require('fs');
const path = require('path');
const xss = require('xss');

const ALLOWED_MEDIA_CATEGORIES = new Set([
  'berita',
  'galeri',
  'pengurus',
]);

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  return xss(value.trim());
}

function getCategoryUploadDir(category) {
  if (!ALLOWED_MEDIA_CATEGORIES.has(category)) {
    throw new Error(
      `Invalid media category: ${category}`
    );
  }

  const root = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(
        __dirname,
        '..',
        'uploads'
      );

  const uploadDir = path.resolve(
    root,
    category
  );

  if (
    !uploadDir.startsWith(
      `${root}${path.sep}`
    )
  ) {
    throw new Error(
      'Invalid upload directory'
    );
  }

  return uploadDir;
}

async function removeManagedImage(
  category,
  logicalPath
) {
  if (
    !ALLOWED_MEDIA_CATEGORIES.has(category)
  ) {
    return;
  }

  if (
    typeof logicalPath !== 'string' ||
    !logicalPath.startsWith(
      `${category}/`
    )
  ) {
    return;
  }

  const uploadDir =
    getCategoryUploadDir(category);

  const filename =
    path.basename(logicalPath);

  const filePath =
    path.resolve(
      uploadDir,
      filename
    );

  if (
    !filePath.startsWith(
      `${uploadDir}${path.sep}`
    )
  ) {
    return;
  }

  await fs.promises
    .unlink(filePath)
    .catch((error) => {
      if (error.code !== 'ENOENT') {
        console.error(
          `[Media] Failed to remove ${category} image:`,
          error.message
        );
      }
    });
}

module.exports = {
  sanitizeText,
  getCategoryUploadDir,
  removeManagedImage,
};