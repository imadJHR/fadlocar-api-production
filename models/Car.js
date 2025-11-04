const mongoose = require('mongoose');

const carImageSchema = new mongoose.Schema({
    filename: {
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
    }
});

const carSpecsSchema = new mongoose.Schema({
    seats: {
        type: Number,
        required: true,
        min: 1,
        max: 50
    },
    fuel: {
        type: String,
        required: true,
        enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid']
    },
    transmission: {
        type: String,
        required: true,
        enum: ['Automatic', 'Manual']
    }
});

const carSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Le nom de la voiture est requis'],
        trim: true,
        maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
    },
    brand: {
        type: String,
        required: [true, 'La marque est requise'],
        trim: true,
        maxlength: [50, 'La marque ne peut pas dépasser 50 caractères']
    },
    type: {
        type: String,
        required: [true, 'Le type est requis'],
        enum: ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Truck']
    },
    price: {
        type: Number,
        required: [true, 'Le prix est requis'],
        min: [0, 'Le prix ne peut pas être négatif']
    },
    description: {
        type: String,
        required: [true, 'La description est requise'],
        maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
    },
    images: [carImageSchema],
    specs: carSpecsSchema,
    available: {
        type: Boolean,
        default: true
    },
    featured: {
        type: Boolean,
        default: false
    },
    rating: {
        type: Number,
        default: 5.0,
        min: [0, 'La note ne peut pas être inférieure à 0'],
        max: [5, 'La note ne peut pas être supérieure à 5']
    },
    reviews: {
        type: Number,
        default: 0,
        min: [0, 'Le nombre d\'avis ne peut pas être négatif']
    },
    slug: {
        type: String,
        unique: true,
        sparse: true
    }
}, {
    timestamps: true
});

// Middleware pour générer le slug avant sauvegarde
carSchema.pre('save', function(next) {
    if (this.isModified('name') || this.isModified('brand') || !this.slug) {
        const baseSlug = `${this.brand.toLowerCase().replace(/\s+/g, '-')}-${this.name.toLowerCase().replace(/\s+/g, '-')}`;
        let slug = baseSlug;
        let counter = 1;
        
        const Car = this.constructor;
        const checkSlug = async () => {
            const existing = await Car.findOne({ slug, _id: { $ne: this._id } });
            if (existing) {
                slug = `${baseSlug}-${counter}`;
                counter++;
                await checkSlug();
            }
        };
        
        checkSlug().then(() => {
            this.slug = slug;
            next();
        }).catch(next);
    } else {
        next();
    }
});

// Index pour les recherches
carSchema.index({ name: 'text', brand: 'text', description: 'text' });
carSchema.index({ type: 1 });
carSchema.index({ price: 1 });
carSchema.index({ available: 1 });
carSchema.index({ featured: 1 });

module.exports = mongoose.model('Car', carSchema);