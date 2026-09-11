const path = require('path');
const fs = require('fs');

const ALLOWED_CATEGORIES = [
  'berita',
  'pengurus',
  'galeri',
];

const FILENAME_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

function getUploadRoot() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, '..', 'uploads');
}

module.exports = (req, res) => {
  const { category, filename } = req.params;

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: 'Invalid image category',
    });
  }

  if (!FILENAME_REGEX.test(filename)) {
    return res.status(400).json({
      error: 'Invalid filename',
    });
  }

  const root = getUploadRoot();
  const categoryDir = path.resolve(root, category);
  const safePath = path.resolve(categoryDir, filename);

  if (
    !safePath.startsWith(
      `${categoryDir}${path.sep}`
    )
  ) {
    return res.status(400).json({
      error: 'Path traversal detected',
    });
  }

  if (!fs.existsSync(safePath)) {
    return res.status(404).json({
      error: 'File not found',
    });
  }

  return res.sendFile(safePath);
};