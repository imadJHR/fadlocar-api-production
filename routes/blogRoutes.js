// backend/routes/blogRoutes.js
const express = require('express');
const multer = require('multer');
const { 
    createPost, 
    getAllPosts, 
    getPostBySlug,
    updatePost,
    deletePost,
    getBlogStats,
    getRelatedPosts 
} = require('../controllers/blogController');
const {protect} = require('../middleware/authMiddleware');
const router = express.Router();

// Multer configuration for blog post images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// --- API Routes ---
router.route('/')
    .post(upload.single('image'), createPost) // Use .single() as we expect one main image
    .get(getAllPosts);

// Route for stats (categories, tags)
router.route('/stats').get(getBlogStats);

router.route('/:id')
    .put(upload.single('image'), updatePost)
    .delete(deletePost);
    
router.route('/slug/:slug').get(getPostBySlug);
router.route('/related/:category/:currentPostSlug').get(getRelatedPosts);

module.exports = router;