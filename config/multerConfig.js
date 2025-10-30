const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = './uploads/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Sanitize filename and create unique name
    const originalName = path.parse(file.originalname).name;
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    cb(null, `${sanitizedName}-${uniqueSuffix}${extension}`);
  },
});

// Improved file type checking
function checkFileType(file, cb) {
  const allowedFileTypes = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };

  const allowedExtensions = /jpeg|jpg|png|gif|webp/;
  
  // Check MIME type
  const isValidMimeType = allowedFileTypes[file.mimetype];
  
  // Check file extension
  const fileExtension = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isValidExtension = allowedExtensions.test(fileExtension);

  if (isValidMimeType && isValidExtension) {
    return cb(null, true);
  } else {
    cb(new Error(`Error: Invalid file type. Only ${Object.keys(allowedFileTypes).join(', ')} are allowed.`));
  }
}

// Error handling for Multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large',
        error: 'File size must be less than 5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'Too many files',
        error: 'Maximum file count exceeded'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Unexpected field',
        error: 'Invalid field name for file upload'
      });
    }
  } else if (error) {
    // Custom errors from checkFileType
    return res.status(400).json({
      message: 'File upload error',
      error: error.message
    });
  }
  next();
};

// Init upload variable
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB in bytes
    files: 12 // Maximum number of files (1 thumbnail + up to 11 images)
  },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

module.exports = { upload, handleMulterError };