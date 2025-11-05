const Car = require('../models/Car');
const fs = require('fs');
const path = require('path');

// ✅ Helper to safely slugify car names
const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

// ======================================================================
// 🟢 CREATE A NEW CAR
// @route POST /api/cars
// ======================================================================
exports.createCar = async (req, res) => {
  try {
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
      seats,
      fuel,
      transmission,
    } = req.body;

    const carData = {
      name,
      brand,
      available: available === 'true' || available === true,
      featured: featured === 'true' || featured === true,
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
    };

    // ✅ Handle uploaded files (if any)
    if (req.files) {
      if (req.files.thumbnail && req.files.thumbnail[0])
        carData.thumbnail = req.files.thumbnail[0].path;
      if (req.files.newImages)
        carData.images = req.files.newImages.map((file) => file.path);
    }

    const car = await Car.create(carData);
    res.status(201).json(car);
  } catch (error) {
    console.error('CREATE CAR ERROR:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          'A car with this name and brand already exists. Please use a unique name.',
      });
    }
    res.status(500).json({ message: 'Error creating car', error: error.message });
  }
};

// ======================================================================
// 🟢 GET ALL CARS
// @route GET /api/cars
// ======================================================================
exports.getCars = async (req, res) => {
  try {
    const cars = await Car.find({});
    res.status(200).json(cars);
  } catch (error) {
    console.error('GET CARS ERROR:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ======================================================================
// 🟢 GET CAR BY SLUG
// @route GET /api/cars/slug/:slug
// ======================================================================
exports.getCarBySlug = async (req, res) => {
  try {
    const car = await Car.findOne({ slug: req.params.slug });
    if (!car) return res.status(404).json({ message: 'Car not found with that slug' });
    res.status(200).json(car);
  } catch (error) {
    console.error('GET CAR BY SLUG ERROR:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// ======================================================================
// 🟢 GET CAR BY ID
// @route GET /api/cars/:id
// ======================================================================
exports.getCarById = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.status(200).json(car);
  } catch (error) {
    console.error('GET CAR BY ID ERROR:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// ======================================================================
// 🟡 UPDATE CAR
// @route PUT /api/cars/:id
// ======================================================================
exports.updateCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });

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
    } = req.body;

    // ✅ Basic fields
    car.name = name || car.name;
    car.brand = brand || car.brand;
    car.type = type || car.type;
    car.price = price ? Number(price) : car.price;
    car.description = description || car.description;
    car.rating = rating ? Number(rating) : car.rating;
    car.reviews = reviews ? Number(reviews) : car.reviews;
    car.featured = featured === 'true' || featured === true;
    car.available = available === 'true' || available === true;

    // ✅ Specs
    car.specs.seats = seats ? Number(seats) : car.specs.seats;
    car.specs.fuel = fuel || car.specs.fuel;
    car.specs.transmission = transmission || car.specs.transmission;

    // ✅ Update slug
    car.slug = slugify(`${car.brand}-${car.name}`);

    // ✅ Delete old images if requested
    if (imagesToDelete) {
      const imagesArray = Array.isArray(imagesToDelete)
        ? imagesToDelete
        : [imagesToDelete];

      car.images = car.images.filter((img) => !imagesArray.includes(img));

      for (const filePath of imagesArray) {
        try {
          const fullPath = path.resolve(__dirname, '..', filePath);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (err) {
          console.warn(`Failed to delete image: ${filePath}`, err.message);
        }
      }
    }

    // ✅ Handle new file uploads
    if (req.files) {
      // Replace thumbnail
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        if (car.thumbnail) {
          try {
            const oldThumb = path.resolve(__dirname, '..', car.thumbnail);
            if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb);
          } catch (err) {
            console.warn(`Failed to delete old thumbnail: ${car.thumbnail}`, err);
          }
        }
        car.thumbnail = req.files.thumbnail[0].path;
      }

      // Add new gallery images
      if (req.files.newImages) {
        const newImagePaths = req.files.newImages.map((file) => file.path);
        car.images.push(...newImagePaths);
      }
    }

    const updatedCar = await car.save();
    res.status(200).json(updatedCar);
  } catch (error) {
    console.error('UPDATE CAR ERROR:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          'A car with this name and brand already exists. Please use a unique name.',
      });
    }
    res.status(500).json({ message: 'Error updating car', error: error.message });
  }
};

// ======================================================================
// 🔴 DELETE CAR
// @route DELETE /api/cars/:id
// ======================================================================
exports.deleteCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });

    const imagePaths = Array.isArray(car.images) ? car.images : [];
    const filesToDelete = [
      ...(car.thumbnail ? [car.thumbnail] : []),
      ...imagePaths,
    ];

    for (const filePath of filesToDelete) {
      try {
        const fullPath = path.resolve(__dirname, '..', filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`✅ Deleted file: ${fullPath}`);
        } else {
          console.warn(`⚠️ File not found, skipping: ${fullPath}`);
        }
      } catch (err) {
        console.error(`❌ Error deleting ${filePath}:`, err.message);
      }
    }

    await car.deleteOne();
    res.status(200).json({ message: 'Car removed successfully' });
  } catch (error) {
    console.error('DELETE CAR ERROR:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// ======================================================================
// 🟢 GET RELATED CARS
// @route GET /api/cars/related/:type/:currentCarSlug
// ======================================================================
exports.getRelatedCars = async (req, res) => {
  try {
    const { type, currentCarSlug } = req.params;
    const cars = await Car.find({
      type,
      slug: { $ne: currentCarSlug },
    }).limit(3);
    res.status(200).json(cars);
  } catch (error) {
    console.error('GET RELATED CARS ERROR:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
