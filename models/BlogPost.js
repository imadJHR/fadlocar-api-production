// backend/models/BlogPost.js
const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  excerpt: { type: String, required: true, trim: true },
  content: { type: String, required: true }, // The full article content
  image: { type: String, required: true }, // Path to the main image
  author: { type: String, required: true },
  authorImage: { type: String },
  category: { type: String, required: true },
  tags: [{ type: String, trim: true }],
  featured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  readTime: { type: Number, required: true }, // Store as minutes
}, {
  timestamps: true,
});

const BlogPost = mongoose.model('BlogPost', blogPostSchema);
module.exports = BlogPost;