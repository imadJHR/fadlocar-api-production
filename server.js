require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");

// Import Cloudinary config
const { cloudinary } = require('./config/cloudinary');

const carRoutes = require('./routes/carRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const userRoutes = require('./routes/userRoutes');
const blogRoutes = require('./routes/blogRoutes');
const contactRoutes = require('./routes/contactRoutes'); 
const statsRoutes = require('./routes/statsRoutes'); 

// Express App
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://fadlocar.vercel.app"], // Ajoutez votre domaine Vercel
    methods: ["GET", "POST"]
  }
});

// Middleware to attach io to each request
app.use((req, res, next) => {
    req.io = io;
    next();
});

io.on('connection', (socket) => {
  console.log('✅ A client connected to WebSockets:', socket.id);
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('<h1>Bienvenue sur mon API !</h1><p>Le serveur fonctionne.</p>');
});


// API Routes
app.use('/api/cars', carRoutes);
app.use('/api/bookings', bookingRoutes); 
app.use('/api/contact', contactRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);

// Connect to DB and Start Server
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT} and connected to MongoDB.`);
      console.log(`☁️  Cloudinary configured for: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err);
  });