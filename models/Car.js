// ../models/Car.js

const mongoose = require('mongoose');
const slugify = require('slugify'); // npm install slugify

// --- Image Schema ---
const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  size: {
    type: Number,
    default: 0
  },
  mimetype: {
    type: String,
    default: 'image/jpeg'
  }
});

const carSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Truck'],
    default: 'Sedan'
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  price: {
    type: Number,
    required: true
  },
  rating: {
    type: Number,
    default: 5.0
  },
  reviews: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },

  // --- Images array ---
  images: [imageSchema],

  // --- Thumbnail field ---
  thumbnail: {
    url: {
      type: String,
      default: ''
    },
    filename: {
      type: String,
      default: ''
    },
    path: {
      type: String,
      default: ''
    }
  },

  available: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  specs: {
    seats: {
      type: Number,
      default: 5
    },
    fuel: {
      type: String,
      enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      default: 'Petrol'
    },
    transmission: {
      type: String,
      enum: ['Automatic', 'Manual'],
      default: 'Automatic'
    },
  },
}, {
  timestamps: true,
});

// --- Automatic slug generation ---
carSchema.pre('save', function (next) {
  if (this.isModified('name') || this.isModified('brand')) {
    const idPart = this._id ? `-${this._id.toString().slice(-6)}` : '';
    this.slug = slugify(`${this.brand}-${this.name}${idPart}`, {
      lower: true,
      strict: true
    });
  }
  next();
});

// --- Automatic thumbnail generation ---
carSchema.pre('save', function (next) {
  // Set thumbnail from primary image or first image
  if (this.images && this.images.length > 0) {
    const primaryImage = this.images.find(img => img.isPrimary) || this.images[0];

    this.thumbnail = {
      url: primaryImage.url,
      filename: primaryImage.filename,
      path: primaryImage.path
    };
  }
  next();
});

// --- Virtual for thumbnail URL (if you want to use virtuals) ---
carSchema.virtual('thumbnailUrl').get(function () {
  if (this.thumbnail && this.thumbnail.url) {
    return this.thumbnail.url;
  }

  // Fallback to first image or default thumbnail
  if (this.images && this.images.length > 0) {
    return this.images[0].url;
  }

  return '/uploads/default-thumbnail.jpg'; // Default fallback
});

const Car = mongoose.model('Car', carSchema);
module.exports = Car;