// ../middleware/firebaseStorage.js
const multer = require('multer');
const path = require('path');
const { bucket } = require('../config/firebase');

// Memory storage for Multer (files will be stored in memory before uploading to Firebase)
const storage = multer.memoryStorage();

// File filter function
const checkFileType = (file, cb) => {
  const allowedFileTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true
  };
  
  const isValidMimeType = allowedFileTypes[file.mimetype];
  const fileExtension = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isValidExtension = /jpeg|jpg|png|gif|webp/.test(fileExtension);

  if (isValidMimeType && isValidExtension) {
    return cb(null, true);
  } else {
    const allowedExtensions = Object.keys(allowedFileTypes).join(', ').replace('image/', '');
    cb(new Error(`Invalid file type. Allowed types: ${allowedExtensions}.`));
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

// Upload fields configuration
const uploadFields = upload.fields([
  { name: 'images', maxCount: 10 }
]);

// Firebase Storage Upload Function
const uploadToFirebase = async (file