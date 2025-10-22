const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true },
  type: { type: String, required: true, default: 'Sedan' },
  slug: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  rating: { type: Number, default: 5.0 },
  reviews: { type: Number, default: 0 },
  description: { type: String, required: true, trim: true },
  images: [{ type: String }],
  thumbnail: { type: String },
  available: { type: Boolean, default: true },
  specs: {
    seats: { type: Number, default: 5 },
    fuel: { type: String, default: 'Petrol' },
    transmission: { type: String, default: 'Automatic' },
    // Removed: year: { type: Number, required: true },
  },
  // Removed: features: [{ type: String, trim: true }],
  featured: { type: Boolean, default: false },
}, {
  timestamps: true,
});

const Car = mongoose.model('Car', carSchema);

module.exports = Car;