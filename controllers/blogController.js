// backend/controllers/blogController.js
const BlogPost = require('../models/BlogPost');
const fs = require('fs');
const path = require('path');

// Helper to create a slug
const slugify = (text) => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');

// --- Create a new Blog Post ---
exports.createPost = async (req, res) => {
    try {
        const { title, excerpt, content, author, category, tags, featured, readTime } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: 'Main image is required.' });
        }

        const newPost = await BlogPost.create({
            title,
            slug: slugify(title),
            excerpt,
            content,
            author,
            category,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            featured: featured === 'true',
            readTime: Number(readTime),
            image: req.file.path,
        });
        res.status(201).json(newPost);
    } catch (error) {
        console.error("CREATE POST ERROR:", error);
        res.status(500).json({ message: 'Error creating post', error: error.message });
    }
};

// --- Get All Blog Posts ---
exports.getAllPosts = async (req, res) => {
    try {
        const posts = await BlogPost.find({}).sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching posts' });
    }
};

// --- Get Single Post by Slug ---
exports.getPostBySlug = async (req, res) => {
    try {
        const post = await BlogPost.findOne({ slug: req.params.slug });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        res.status(200).json(post);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching post' });
    }
};

// --- Update a Blog Post ---
exports.updatePost = async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const { title, excerpt, content, author, category, tags, featured, readTime } = req.body;
        
        post.title = title || post.title;
        post.slug = slugify(title || post.title);
        post.excerpt = excerpt || post.excerpt;
        post.content = content || post.content;
        post.author = author || post.author;
        post.category = category || post.category;
        post.tags = tags ? tags.split(',').map(tag => tag.trim()) : post.tags;
        if (featured !== undefined) post.featured = featured === 'true';
        post.readTime = Number(readTime) || post.readTime;

        if (req.file) {
            // Delete old image if it exists
            if (post.image) {
                fs.unlink(path.join(__dirname, '..', post.image), err => {
                    if (err) console.error("Failed to delete old image:", err);
                });
            }
            post.image = req.file.path;
        }

        const updatedPost = await post.save();
        res.status(200).json(updatedPost);
    } catch (error) {
        res.status(500).json({ message: 'Error updating post', error: error.message });
    }
};

// --- Delete a Blog Post ---
exports.deletePost = async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        if (post.image) {
            fs.unlink(path.join(__dirname, '..', post.image), err => {
                if (err) console.error("Failed to delete image on post removal:", err);
            });
        }
        await post.deleteOne();
        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting post' });
    }
};

// --- Get Blog Stats (Categories & Tags) ---
exports.getBlogStats = async (req, res) => {
    try {
        const categories = await BlogPost.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $project: { name: '$_id', count: 1, _id: 0 } },
            { $sort: { count: -1 } }
        ]);

        const tags = await BlogPost.aggregate([
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $project: { name: '$_id', count: 1, _id: 0 } },
            { $sort: { count: -1 } },
            { $limit: 10 } // Get top 10 popular tags
        ]);

        res.status(200).json({ categories, tags });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching blog stats' });
    }
};
exports.getRelatedPosts = async (req, res) => {
    try {
        const { category, currentPostSlug } = req.params;
        const posts = await BlogPost.find({
            category: category,
            slug: { $ne: currentPostSlug } // Exclude the current post
        }).limit(3); // Get up to 3 related posts

        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching related posts' });
    }
};