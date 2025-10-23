const mongoose = require('mongoose');
const carSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true },
  type: { type: String, required: true, default: 'Sedan' },
  slug: { type: String, required: true, unique: true }, // Le slug n'inclura plus l'année
  price: { type: Number, required: true },
  rating: { type: Number, default: 5.0 },
  reviews: { type: Number, default: 0 },
  description: { type: String, required: true, trim: true },
  images: [{ type: String }],
  thumbnail: { type: String },
  available: { type: Boolean, default: true },
  featured: { type: Boolean, default: false }, // Ajouté pour la cohérence
  specs: {
    seats: { type: Number, default: 5 },
    fuel: { type: String, default: 'Petrol' },
    transmission: { type: String, default: 'Automatic' },
  },
}, {
  timestamps: true,
});
const Car = mongoose.model('Car', carSchema);
module.exports = Car;