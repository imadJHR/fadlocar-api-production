require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');

// --- Routes ---
const carRoutes = require('./routes/carRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const userRoutes = require('./routes/userRoutes');
const blogRoutes = require('./routes/blogRoutes');
const contactRoutes = require('./routes/contactRoutes');
const statsRoutes = require('./routes/statsRoutes');

// --- Express App ---
const app = express();
const server = http.createServer(app);

// --- Basic CORS (no restrictions) ---
app.use(cors());

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Root Route ---
app.get('/', (req, res) => {
  res.send(`
    <h1>🚗 Fadlocar API</h1>
    <p>✅ Backend server is running successfully.</p>
  `);
});

// --- Static Uploads (⚠️ Not persistent on Vercel)---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- API Routes ---
app.use('/api/cars', carRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/blog', blogRoutes);
app.use("/api/users", require("./routes/userRoutes"));
app.use('/api/stats', statsRoutes);

// --- Database Connection & Server Start ---
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in environment variables!');
  process.exit(1);
}

mongoose.set('strictQuery', false);

mongoose.connect(MONGO_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT} and connected to MongoDB`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
