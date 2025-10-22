const Car = require('../models/Car');
const fs = require('fs');
const path = require('path');

// Helper function to create a URL-friendly slug
const slugify = (text) => text.toString().toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^\w\-]+/g, '')
  .replace(/\-\-+/g, '-')
  .replace(/^-+/, '')
  .replace(/-+$/, '');

// @desc    Create a new car
// @route   POST /api/cars
exports.createCar = async (req, res) => {
  try {
    const { name, brand, rating, reviews, available, featured, type, price, description, seats, fuel, transmission } = req.body;

    const carData = {
      name,
      brand,
      available: available === 'true' || available === true,
      type,
      price: Number(price),
      description,
      rating: Number(rating) || 5.0,
      reviews: Number(reviews) || 0,
      slug: slugify(`${brand}-${name}`),
      specs: {
        seats: Number(seats),
        fuel,
        transmission,
      },
      // Removed: features field
      featured: featured === 'true' || featured === true,
    };

    if (req.files) {
      if (req.files.thumbnail) {
        carData.thumbnail = req.files.thumbnail[0].path;
      }
      if (req.files.newImages && Array.isArray(req.files.newImages)) {
        carData.images = req.files.newImages.map(file => file.path);
      }
    }

    const car = await Car.create(carData);
    res.status(201).json(car);
  } catch (error) {
    console.error('CREATE CAR ERROR:', error);
    res.status(500).json({ message: 'Error creating car', error: error.message });
  }
};

// @desc    Get all cars
// @route   GET /api/cars
exports.getCars = async (req, res) => {
  try {
    const cars = await Car.find({});
    res.status(200).json(cars);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get a single car by Slug
// @route   GET /api/cars/slug/:slug
exports.getCarBySlug = async (req, res) => {
  try {
    const car = await Car.findOne({ slug: req.params.slug });
    if (car) {
      res.status(200).json(car);
    } else {
      res.status(404).json({ message: 'Car not found with that slug' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get a single car by ID
// @route   GET /api/cars/:id
exports.getCarById = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }
    res.status(200).json(car);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a car
// @route   PUT /api/cars/:id
exports.updateCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    const { name, brand, type, price, description, featured, seats, fuel, transmission, available, imagesToDelete, rating, reviews } = req.body;
    
    car.rating = Number(rating) || car.rating;
    car.reviews = Number(reviews) || car.reviews;
    car.name = name || car.name;
    car.brand = brand || car.brand;
    car.type = type || car.type;
    car.price = Number(price) || car.price;
    car.description = description || car.description;
    car.slug = slugify(`${car.brand}-${car.name}`);
    
    car.specs.seats = Number(seats) || car.specs.seats;
    car.specs.fuel = fuel || car.specs.fuel;
    car.specs.transmission = transmission || car.specs.transmission;
    
    // Removed: features field handling

    if (available !== undefined) {
      car.available = available === 'true' || available === true;
    }
    if (featured !== undefined) {
      car.featured = featured === 'true' || featured === true;
    }

    if (imagesToDelete) {
      const imagesToDeleteArray = Array.isArray(imagesToDelete) ? imagesToDelete : [imagesToDelete];
      car.images = car.images.filter(img => !imagesToDeleteArray.includes(img));
      imagesToDeleteArray.forEach(filePath => {
        if (filePath) {
          fs.unlink(path.join(__dirname, '..', filePath), (err) => {
            if (err) console.error(`Failed to delete file: ${filePath}`, err);
          });
        }
      });
    }

    if (req.files) {
      if (req.files.thumbnail) {
        if (car.thumbnail) {
          fs.unlink(path.join(__dirname, '..', car.thumbnail), err => {
            if (err) console.error(`Failed to delete old thumbnail: ${car.thumbnail}`, err);
          });
        }
        car.thumbnail = req.files.thumbnail[0].path;
      }
      if (req.files.newImages) {
        const newImagePaths = req.files.newImages.map(file => file.path);
        car.images.push(...newImagePaths);
      }
    }

    const updatedCar = await car.save();
    res.status(200).json(updatedCar);
  } catch (error) {
    console.error('UPDATE CAR ERROR:', error);
    res.status(500).json({ message: 'Error updating car', error: error.message });
  }
};

// @desc    Delete a car
// @route   DELETE /api/cars/:id
exports.deleteCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    const filesToDelete = car.thumbnail ? [car.thumbnail, ...car.images] : [...car.images];

    filesToDelete.forEach(filePath => {
      if (filePath) {
        fs.unlink(path.join(__dirname, '..', filePath), (err) => {
          if (err) console.error(`Failed to delete file on car removal: ${filePath}`, err);
        });
      }
    });

    await car.deleteOne();
    res.status(200).json({ message: 'Car removed' });
  } catch (error) {
    console.error('DELETE CAR ERROR:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get related cars
// @route   GET /api/cars/related/:type/:currentCarSlug
exports.getRelatedCars = async (req, res) => {
  try {
    const { type, currentCarSlug } = req.params;

    const cars = await Car.find({
      type: type,
      slug: { $ne: currentCarSlug }
    }).limit(3);

    res.status(200).json(cars);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};