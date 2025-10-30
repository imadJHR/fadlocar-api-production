const Car = require('../models/Car');
const fs = require('fs');
const path = require('path');

const slugify = (text) => text.toString().toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^\w\-]+/g, '')
  .replace(/\-\-+/g, '-')
  .replace(/^-+/, '')
  .replace(/-+$/, '');

// @desc    Créer une nouvelle voiture
exports.createCar = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);

    // Parse specs from body or individual fields
    const { 
      name, 
      brand, 
      rating, 
      reviews, 
      available, 
      featured, 
      type, 
      price, 
      description,
      // Handle both specs object and individual spec fields
      specs,
      seats,
      fuel,
      transmission
    } = req.body;

    // Build car data with proper field mapping
    const carData = {
      name,
      brand,
      available: available === 'true' || available === true,
      featured: featured === 'true' || featured === true,
      type,
      price: Number(price) || 0,
      description,
      rating: Number(rating) || 5.0,
      reviews: Number(reviews) || 0,
      slug: slugify(`${brand}-${name}-${Date.now()}`), // Add timestamp for uniqueness
      specs: {
        seats: Number(specs?.seats || seats || 5),
        fuel: specs?.fuel || fuel || 'Petrol',
        transmission: specs?.transmission || transmission || 'Automatic',
      }
    };

    // Handle file uploads
    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        carData.thumbnail = req.files.thumbnail[0].path;
      }
      
      // Use 'images' instead of 'newImages' to match frontend
      if (req.files.images) {
        carData.images = req.files.images.map(file => file.path);
      }
      // Also check for 'newImages' for backward compatibility
      else if (req.files.newImages) {
        carData.images = req.files.newImages.map(file => file.path);
      }
    }

    console.log('Final car data:', carData);
    const car = await Car.create(carData);
    res.status(201).json(car);
  } catch (error) {
    console.error('CREATE CAR ERROR:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Erreur : Une voiture avec ce nom et cette marque existe déjà. Le nom doit être unique.' 
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Données de validation invalides', 
        errors: error.errors 
      });
    }
    res.status(500).json({ 
      message: 'Erreur lors de la création de la voiture', 
      error: error.message 
    });
  }
};

// @desc    Obtenir toutes les voitures
exports.getCars = async (req, res) => {
  try {
    const cars = await Car.find({}).sort({ createdAt: -1 });
    res.status(200).json(cars);
  } catch (error) {
    console.error('GET CARS ERROR:', error);
    res.status(500).json({ 
      message: 'Erreur serveur lors de la récupération des voitures', 
      error: error.message 
    });
  }
};

// @desc    Obtenir une voiture par Slug
exports.getCarBySlug = async (req, res) => {
  try {
    const car = await Car.findOne({ slug: req.params.slug });
    if (car) {
      res.status(200).json(car);
    } else {
      res.status(404).json({ message: 'Voiture non trouvée avec ce slug' });
    }
  } catch (error) {
    console.error('GET CAR BY SLUG ERROR:', error);
    res.status(500).json({ 
      message: 'Erreur serveur', 
      error: error.message 
    });
  }
};

// @desc    Obtenir une voiture par ID
exports.getCarById = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Voiture non trouvée' });
    }
    res.status(200).json(car);
  } catch (error) {
    console.error('GET CAR BY ID ERROR:', error);
    res.status(500).json({ 
      message: 'Erreur serveur', 
      error: error.message 
    });
  }
};

// @desc    Mettre à jour une voiture
exports.updateCar = async (req, res) => {
  try {
    console.log('Update request body:', req.body);
    console.log('Update request files:', req.files);

    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Voiture non trouvée' });
    }

    const { 
      name, 
      brand, 
      type, 
      price, 
      description, 
      featured, 
      seats, 
      fuel, 
      transmission, 
      available, 
      imagesToDelete, 
      rating, 
      reviews,
      specs 
    } = req.body;

    // Update basic fields
    if (name) car.name = name;
    if (brand) car.brand = brand;
    if (type) car.type = type;
    if (price) car.price = Number(price);
    if (description) car.description = description;
    if (rating) car.rating = Number(rating);
    if (reviews) car.reviews = Number(reviews);
    
    // Update specs - handle both individual fields and specs object
    if (specs) {
      car.specs.seats = Number(specs.seats) || car.specs.seats;
      car.specs.fuel = specs.fuel || car.specs.fuel;
      car.specs.transmission = specs.transmission || car.specs.transmission;
    } else {
      if (seats) car.specs.seats = Number(seats);
      if (fuel) car.specs.fuel = fuel;
      if (transmission) car.specs.transmission = transmission;
    }
    
    // Update slug if name or brand changed
    if (name || brand) {
      car.slug = slugify(`${car.brand}-${car.name}-${car._id}`);
    }

    // Update boolean fields
    if (available !== undefined) {
      car.available = available === 'true' || available === true;
    }
    if (featured !== undefined) {
      car.featured = featured === 'true' || featured === true;
    }

    // Gestion de la suppression d'images
    if (imagesToDelete) {
      const imagesToDeleteArray = Array.isArray(imagesToDelete) ? imagesToDelete : [imagesToDelete];
      
      // Filter out images to delete
      car.images = car.images.filter(img => !imagesToDeleteArray.includes(img));
      
      // Delete physical files
      imagesToDeleteArray.forEach(filePath => {
        if (filePath && fs.existsSync(path.join(__dirname, '..', filePath))) {
          fs.unlink(path.join(__dirname, '..', filePath), (err) => {
            if (err) console.error(`Failed to delete file: ${filePath}`, err);
          });
        }
      });
    }

    // Gestion des nouveaux téléversements d'images
    if (req.files) {
      // Update thumbnail
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        // Delete old thumbnail if exists
        if (car.thumbnail && fs.existsSync(path.join(__dirname, '..', car.thumbnail))) {
          fs.unlink(path.join(__dirname, '..', car.thumbnail), err => {
            if (err) console.error(`Failed to delete old thumbnail: ${car.thumbnail}`, err);
          });
        }
        car.thumbnail = req.files.thumbnail[0].path;
      }
      
      // Add new images
      if (req.files.images) {
        const newImagePaths = req.files.images.map(file => file.path);
        car.images.push(...newImagePaths);
      }
      // Also check for 'newImages' for backward compatibility
      else if (req.files.newImages) {
        const newImagePaths = req.files.newImages.map(file => file.path);
        car.images.push(...newImagePaths);
      }
    }

    const updatedCar = await car.save();
    res.status(200).json(updatedCar);
  } catch (error) {
    console.error('UPDATE CAR ERROR:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Erreur : Une voiture avec ce nom et cette marque existe déjà.' 
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Données de validation invalides', 
        errors: error.errors 
      });
    }
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour de la voiture', 
      error: error.message 
    });
  }
};

// @desc    Supprimer une voiture
exports.deleteCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Voiture non trouvée' });
    }

    // Delete associated files
    const filesToDelete = [];
    if (car.thumbnail) filesToDelete.push(car.thumbnail);
    if (car.images && car.images.length > 0) {
      filesToDelete.push(...car.images);
    }

    filesToDelete.forEach(filePath => {
      if (filePath && fs.existsSync(path.join(__dirname, '..', filePath))) {
        fs.unlink(path.join(__dirname, '..', filePath), (err) => {
          if (err) console.error(`Failed to delete file on car removal: ${filePath}`, err);
        });
      }
    });

    await Car.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Voiture supprimée avec succès' });
  } catch (error) {
    console.error('DELETE CAR ERROR:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression de la voiture', 
      error: error.message 
    });
  }
};

// @desc    Obtenir les voitures similaires
exports.getRelatedCars = async (req, res) => {
  try {
    const { type, currentCarSlug } = req.params;
    const cars = await Car.find({
      type: type,
      slug: { $ne: currentCarSlug },
      available: true
    }).limit(3);
    
    res.status(200).json(cars);
  } catch (error) {
    console.error('GET RELATED CARS ERROR:', error);
    res.status(500).json({ 
      message: 'Erreur serveur', 
      error: error.message 
    });
  }
};