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
}, { _id: false }); // Don't create _id for subdocuments

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
    unique: true,
    sparse: true // Allow null during creation
  },
  price: {
    type: Number,
    required: true
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 0,
    max: 5
  },
  reviews: {
    type: Number,
    default: 0,
    min: 0
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
      default: 5,
      min: 1,
      max: 50
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// --- Index for better query performance ---
carSchema.index({ slug: 1 });
carSchema.index({ brand: 1, name: 1 });
carSchema.index({ type: 1 });
carSchema.index({ available: 1 });
carSchema.index({ featured: 1 });

// --- Automatic slug generation ---
carSchema.pre('save', function (next) {
  // Generate slug on creation or when name/brand changes
  if (this.isNew || this.isModified('name') || this.isModified('brand')) {
    const baseSlug = slugify(`${this.brand}-${this.name}`, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
    
    // Add ID suffix for uniqueness (after first save, ID exists)
    if (this._id) {
      this.slug = `${baseSlug}-${this._id.toString().slice(-6)}`;
    } else {
      // Temporary slug on first save (will be updated after save hook)
      this.slug = baseSlug;
    }
  }
  next();
});

// --- Update slug after save if ID wasn't available ---
carSchema.post('save', async function (doc) {
  // If slug doesn't contain the ID suffix, update it
  if (doc._id && doc.slug && !doc.slug.endsWith(doc._id.toString().slice(-6))) {
    const baseSlug = slugify(`${doc.brand}-${doc.name}`, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
    
    doc.slug = `${baseSlug}-${doc._id.toString().slice(-6)}`;
    await doc.save();
  }
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
  } else if (this.isModified('images') && this.images.length === 0) {
    // Clear thumbnail if all images are removed
    this.thumbnail = {
      url: '',
      filename: '',
      path: ''
    };
  }
  next();
});

// --- Helper method to process Multer files ---
carSchema.methods.processUploadedImages = function(files, baseUrl = '') {
  if (!files || !files.length) {
    return [];
  }

  return files.map((file, index) => ({
    url: `${baseUrl}/uploads/${file.filename}`,
    filename: file.filename,
    path: file.path,
    alt: `${this.brand} ${this.name} - Image ${index + 1}`,
    isPrimary: index === 0, // First image is primary by default
    size: file.size,
    mimetype: file.mimetype
  }));
};

// --- Helper method to add new images ---
carSchema.methods.addImages = function(files, baseUrl = '') {
  const newImages = this.processUploadedImages(files, baseUrl);
  
  // If this is the first batch of images, set first as primary
  if (this.images.length === 0 && newImages.length > 0) {
    newImages[0].isPrimary = true;
  } else {
    // Otherwise, no new image should be primary by default
    newImages.forEach(img => img.isPrimary = false);
  }
  
  this.images.push(...newImages);
  return newImages;
};

// --- Helper method to replace all images ---
carSchema.methods.replaceImages = function(files, baseUrl = '') {
  this.images = this.processUploadedImages(files, baseUrl);
  return this.images;
};

// --- Helper method to set primary image ---
carSchema.methods.setPrimaryImage = function(imageFilename) {
  // Remove primary flag from all images
  this.images.forEach(img => img.isPrimary = false);
  
  // Set new primary image
  const primaryImage = this.images.find(img => img.filename === imageFilename);
  if (primaryImage) {
    primaryImage.isPrimary = true;
    return true;
  }
  return false;
};

// --- Virtual for thumbnail URL ---
carSchema.virtual('thumbnailUrl').get(function () {
  if (this.thumbnail && this.thumbnail.url) {
    return this.thumbnail.url;
  }

  // Fallback to first image
  if (this.images && this.images.length > 0) {
    return this.images[0].url;
  }

  // Default fallback
  return '/uploads/default-thumbnail.jpg';
});

// --- Virtual for primary image ---
carSchema.virtual('primaryImage').get(function () {
  if (this.images && this.images.length > 0) {
    return this.images.find(img => img.isPrimary) || this.images[0];
  }
  return null;
});

const Car = mongoose.model('Car', carSchema);
module.exports = Car;