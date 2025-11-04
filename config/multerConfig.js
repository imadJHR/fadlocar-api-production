// api/config/multerConfig.js
const multer = require('multer');
const path = require('path');

// Memory storage for Multer
const storage = multer.memoryStorage();

// File filter function
const checkFileType = (file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif|webp/;
  const isValidMimeType = allowedFileTypes.test(file.mimetype);
  const isValidExtension = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());

  if (isValidMimeType && isValidExtension) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: JPEG, JPG, PNG, GIF, WebP.'));
  }
};

// Configure Multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

// Upload configurations
const uploadSingle = upload.single('image');
const uploadMultiple = upload.array('images', 10);
const uploadFields = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 1 }
]);

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields
};