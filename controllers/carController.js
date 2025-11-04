// api/controllers/carController.js
const Car = require('../models/Car');
const FirebaseStorageService = require('../services/firebaseStorageService');

// Helper function to create image objects from Firebase upload results
const createImageObject = (uploadResult, isPrimary = false) => ({
  url: uploadResult.url,
  filename: uploadResult.filename,
  path: uploadResult.filename, // Use filename as path for Firebase
  alt: uploadResult.originalName || `Car image ${uploadResult.filename}`,
  isPrimary: isPrimary,
  size: uploadResult.size,
  mimetype: uploadResult.mimetype
});

// Helper function to format car data
const formatCarData = (car) => {
  const carObj = car.toObject ? car.toObject() : { ...car };

  // Find primary image
  const primaryImg = carObj.images?.find(img => img.isPrimary) || carObj.images?.[0] || null;

  // Format thumbnail
  let thumbnail = null;
  if (carObj.thumbnail && carObj.thumbnail.url) {
    thumbnail = carObj.thumbnail;
  } else if (primaryImg) {
    thumbnail = {
      url: primaryImg.url,
      filename: primaryImg.filename,
      path: primaryImg.path
    };
  }

  return {
    ...carObj,
    thumbnail,
    primaryImage: primaryImg ? primaryImg.url : null,
    thumbnailUrl: thumbnail ? thumbnail.url : (primaryImg ? primaryImg.url : null)
  };
};

// Helper function to validate price
const validatePrice = (price) => {
  const priceNum = Number(price);
  if (isNaN(priceNum) || priceNum < 0) {
    throw new Error('Price must be a positive number');
  }
  if (priceNum % 100 !== 0) {
    throw new Error('Price must be a multiple of 100');
  }
  return priceNum;
};

// @desc    Create a new car
// @route   POST /api/cars
// @access  Private (Admin)
exports.createCar = async (req, res) => {
  let uploadedFiles = [];

  try {
    console.log('=== START CREATE CAR ===');
    console.log('📦 Request body:', req.body);

    const {
      name, brand, rating, reviews, available,
      featured, type, price, description,
      seats, fuel, transmission,
      primaryImageIndex
    } = req.body;

    // Validate required fields
    if (!name || !brand || !price || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, brand, price, and description are required'
      });
    }

    // Validate price
    const validatedPrice = validatePrice(price);

    // Validate images
    if (!req.files || !req.files.images || req.files.images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    // Upload images to Firebase
    console.log(`📤 Uploading ${req.files.images.length} images to Firebase...`);
    const uploadResults = await FirebaseStorageService.uploadMultipleFiles(req.files.images, 'cars');
    uploadedFiles = uploadResults;

    const primaryIndex = parseInt(primaryImageIndex) || 0;

    // Process uploaded images
    const images = uploadResults.map((result, index) =>
      createImageObject(result, index === primaryIndex)
    );

    // Create car data
    const carData = {
      name: name.trim(),
      brand: brand.trim(),
      available: available === 'true' || available === true,
      featured: featured === 'true' || featured === true,
      type: type || 'Sedan',
      price: validatedPrice,
      description: description.trim(),
      rating: rating ? Math.min(5, Math.max(0, Number(rating))) : 5.0,
      reviews: reviews ? Math.max(0, Number(reviews)) : 0,
      specs: {
        seats: seats ? Math.max(1, Math.min(50, Number(seats))) : 5,
        fuel: fuel || 'Petrol',
        transmission: transmission || 'Automatic',
      },
      images
    };

    console.log(`✅ Processed ${images.length} images. Primary: index ${primaryIndex}`);

    // Create car
    const car = await Car.create(carData);
    console.log('✅ Car created successfully - ID:', car._id);

    // Format response
    const formattedCar = formatCarData(car);

    res.status(201).json({
      success: true,
      data: formattedCar,
      message: 'Car created successfully'
    });

  } catch (error) {
    console.error('❌ CREATE CAR ERROR:', error);

    // Delete uploaded files from Firebase on error
    if (uploadedFiles.length > 0) {
      try {
        const fileUrls = uploadedFiles.map(file => file.url);
        await FirebaseStorageService.deleteMultipleFiles(fileUrls);
        console.log('🗑️ Cleaned up uploaded files due to error');
      } catch (cleanupError) {
        console.error('❌ Error cleaning up files:', cleanupError);
      }
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A car with this name and brand already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Error creating car'
    });
  }
};

// @desc    Get all cars
// @route   GET /api/cars
// @access  Public
exports.getCars = async (req, res) => {
  try {
    console.log('📋 Getting all cars');

    const { page = 1, limit = 10, sort = '-createdAt', search, type, fuel, minPrice, maxPrice, available } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (type) filter.type = type;
    if (fuel) filter['specs.fuel'] = fuel;
    if (available !== undefined) filter.available = available === 'true';

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const cars = await Car.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Car.countDocuments(filter);
    const carsFormatted = cars.map(car => formatCarData(car));

    console.log(`✅ ${cars.length} cars retrieved (page ${page})`);

    res.status(200).json({
      success: true,
      data: carsFormatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('❌ GET CARS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving cars'
    });
  }
};

// @desc    Get car by Slug
// @route   GET /api/cars/slug/:slug
// @access  Public
exports.getCarBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`🔍 Searching for car with slug: ${slug}`);

    const car = await Car.findOne({ slug });

    if (!car) {
      console.log(`❌ Car not found with slug: ${slug}`);
      return res.status(404).json({
        success: false,
        message: 'Car not found with this slug'
      });
    }

    const formattedCar = formatCarData(car);

    console.log(`✅ Car found: ${car.brand} ${car.name}`);

    res.status(200).json({
      success: true,
      data: formattedCar
    });
  } catch (error) {
    console.error('❌ GET CAR BY SLUG ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get car by ID
// @route   GET /api/cars/:id
// @access  Public
exports.getCarById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Searching for car with ID: ${id}`);

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid car ID format'
      });
    }

    const car = await Car.findById(id);

    if (!car) {
      console.log(`❌ Car not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    const formattedCar = formatCarData(car);

    console.log(`✅ Car found: ${car.brand} ${car.name}`);

    res.status(200).json({
      success: true,
      data: formattedCar
    });
  } catch (error) {
    console.error('❌ GET CAR BY ID ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update a car
// @route   PUT /api/cars/:id
// @access  Private (Admin)
exports.updateCar = async (req, res) => {
  let newUploadedFiles = [];

  try {
    console.log('=== START UPDATE CAR ===');
    console.log('📦 Request body:', req.body);

    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid car ID format'
      });
    }

    const car = await Car.findById(id);

    if (!car) {
      console.log(`❌ Car not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    const {
      name, brand, type, price, description, featured,
      seats, fuel, transmission, available, imagesToDelete,
      rating, reviews, primaryImageIndex
    } = req.body;

    // Update basic fields
    if (name !== undefined) car.name = name.trim();
    if (brand !== undefined) car.brand = brand.trim();
    if (type !== undefined) car.type = type;
    if (price !== undefined) {
      const validatedPrice = validatePrice(price);
      car.price = validatedPrice;
    }
    if (description !== undefined) car.description = description.trim();
    if (rating !== undefined) car.rating = Math.min(5, Math.max(0, Number(rating)));
    if (reviews !== undefined) car.reviews = Math.max(0, Number(reviews));

    // Update specs
    if (seats !== undefined) car.specs.seats = Math.max(1, Math.min(50, Number(seats)));
    if (fuel !== undefined) car.specs.fuel = fuel;
    if (transmission !== undefined) car.specs.transmission = transmission;

    // Update boolean fields
    if (available !== undefined) car.available = available === 'true' || available === true;
    if (featured !== undefined) car.featured = featured === 'true' || featured === true;

    // Handle image deletion first
    if (imagesToDelete) {
      let imagesToDeleteArray;
      try {
        imagesToDeleteArray = Array.isArray(imagesToDelete)
          ? imagesToDelete
          : JSON.parse(imagesToDelete);
      } catch (parseError) {
        imagesToDeleteArray = imagesToDelete.split(',').map(img => img.trim());
      }

      console.log('🗑️ Images to delete from Firebase:', imagesToDeleteArray);

      const initialImageCount = car.images.length;

      // Filter out images to delete and get their URLs
      const imagesToDeleteUrls = car.images
        .filter(img => imagesToDeleteArray.includes(img.filename) || imagesToDeleteArray.includes(img._id.toString()))
        .map(img => img.url);

      car.images = car.images.filter(img =>
        !imagesToDeleteArray.includes(img.filename) && !imagesToDeleteArray.includes(img._id.toString())
      );

      console.log(`🗑️ Images: ${initialImageCount} → ${car.images.length}`);

      // Delete physical files from Firebase
      if (imagesToDeleteUrls.length > 0) {
        await FirebaseStorageService.deleteMultipleFiles(imagesToDeleteUrls);
      }
    }

    // Handle new image uploads
    if (req.files && req.files.images && req.files.images.length > 0) {
      console.log(`📤 Uploading ${req.files.images.length} new images to Firebase...`);
      const newUploadResults = await FirebaseStorageService.uploadMultipleFiles(req.files.images, 'cars');
      newUploadedFiles = newUploadResults;

      const newImages = newUploadResults.map(result =>
        createImageObject(result, false)
      );
      
      car.images.push(...newImages);
      console.log(`✅ Added ${newImages.length} new images`);
    }

    // Validate that at least one image exists
    if (car.images.length === 0) {
      // Delete newly uploaded files if no images remain
      if (newUploadedFiles.length > 0) {
        const fileUrls = newUploadedFiles.map(file => file.url);
        await FirebaseStorageService.deleteMultipleFiles(fileUrls);
      }
      return res.status(400).json({
        success: false,
        message: 'Car must have at least one image'
      });
    }

    // Handle primary image selection
    if (primaryImageIndex !== undefined && primaryImageIndex !== null && primaryImageIndex !== '') {
      const primaryIndex = parseInt(primaryImageIndex);
      console.log(`⭐ Setting primary image to index: ${primaryIndex}`);

      // Reset all images as non-primary
      car.images.forEach(img => img.isPrimary = false);

      // Set the new primary image
      if (car.images[primaryIndex]) {
        car.images[primaryIndex].isPrimary = true;
        console.log(`✅ Primary image set: ${car.images[primaryIndex].filename}`);
      } else {
        console.log(`⚠️ Invalid primary index ${primaryIndex}, using first image`);
        car.images[0].isPrimary = true;
      }
    }

    // Ensure there's always a primary image
    if (!car.images.some(img => img.isPrimary)) {
      car.images[0].isPrimary = true;
      console.log('⭐ Set first image as primary (fallback)');
    }

    // Save the car
    const updatedCar = await car.save();
    const formattedCar = formatCarData(updatedCar);

    console.log('✅ Car updated successfully - ID:', updatedCar._id);

    res.status(200).json({
      success: true,
      data: formattedCar,
      message: 'Car updated successfully'
    });

  } catch (error) {
    console.error('❌ UPDATE CAR ERROR:', error);

    // Delete newly uploaded files from Firebase on error
    if (newUploadedFiles.length > 0) {
      try {
        const fileUrls = newUploadedFiles.map(file => file.url);
        await FirebaseStorageService.deleteMultipleFiles(fileUrls);
        console.log('🗑️ Cleaned up newly uploaded files due to error');
      } catch (cleanupError) {
        console.error('❌ Error cleaning up files:', cleanupError);
      }
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A car with this name and brand already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Error updating car'
    });
  }
};

// @desc    Delete a car
// @route   DELETE /api/cars/:id
// @access  Private (Admin)
exports.deleteCar = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting car with ID: ${id}`);

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid car ID format'
      });
    }

    const car = await Car.findById(id);

    if (!car) {
      console.log(`❌ Car not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    // Delete associated image files from Firebase
    const filesToDelete = car.images?.map(img => img.url).filter(Boolean) || [];
    console.log(`🗑️ Deleting ${filesToDelete.length} image files from Firebase`);

    if (filesToDelete.length > 0) {
      await FirebaseStorageService.deleteMultipleFiles(filesToDelete);
    }

    // Delete car from database
    await Car.findByIdAndDelete(id);

    console.log(`✅ Car deleted successfully - ID: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Car and associated images deleted successfully',
      deletedCarId: id
    });

  } catch (error) {
    console.error('❌ DELETE CAR ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting car'
    });
  }
};

// @desc    Get related cars
// @route   GET /api/cars/related/:type/:currentCarSlug
// @access  Public
exports.getRelatedCars = async (req, res) => {
  try {
    const { type, currentCarSlug } = req.params;
    const { limit = 3 } = req.query;

    console.log(`🔍 Getting related cars - Type: ${type}, Exclude: ${currentCarSlug}`);

    const cars = await Car.find({
      type: type,
      slug: { $ne: currentCarSlug },
      available: true
    })
      .limit(Number(limit))
      .sort({ rating: -1, createdAt: -1 });

    const carsFormatted = cars.map(car => formatCarData(car));

    console.log(`✅ ${cars.length} related cars found`);

    res.status(200).json({
      success: true,
      data: carsFormatted,
      count: cars.length
    });
  } catch (error) {
    console.error('❌ GET RELATED CARS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get available cars
// @route   GET /api/cars/available
// @access  Public
exports.getAvailableCars = async (req, res) => {
  try {
    console.log('🔍 Getting available cars');

    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const cars = await Car.find({ available: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Car.countDocuments({ available: true });
    const carsFormatted = cars.map(car => formatCarData(car));

    console.log(`✅ ${cars.length} available cars found`);

    res.status(200).json({
      success: true,
      data: carsFormatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('❌ GET AVAILABLE CARS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving available cars'
    });
  }
};

// @desc    Get featured cars
// @route   GET /api/cars/featured
// @access  Public
exports.getFeaturedCars = async (req, res) => {
  try {
    console.log('🔍 Getting featured cars');

    const { limit = 6 } = req.query;

    const cars = await Car.find({
      featured: true,
      available: true
    })
      .sort({ rating: -1, createdAt: -1 })
      .limit(Number(limit));

    const carsFormatted = cars.map(car => formatCarData(car));

    console.log(`✅ ${cars.length} featured cars found`);

    res.status(200).json({
      success: true,
      data: carsFormatted,
      count: cars.length
    });
  } catch (error) {
    console.error('❌ GET FEATURED CARS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving featured cars'
    });
  }
};

// @desc    Search cars
// @route   GET /api/cars/search
// @access  Public
exports.searchCars = async (req, res) => {
  try {
    const {
      query, type, fuel, transmission,
      minPrice, maxPrice, available, featured,
      page = 1, limit = 10, sort = '-createdAt'
    } = req.query;

    console.log('🔍 Searching cars with filters:', req.query);

    let searchCriteria = {};

    // Text search
    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }

    // Filters
    if (type) searchCriteria.type = type;
    if (fuel) searchCriteria['specs.fuel'] = fuel;
    if (transmission) searchCriteria['specs.transmission'] = transmission;
    if (available !== undefined) searchCriteria.available = available === 'true';
    if (featured !== undefined) searchCriteria.featured = featured === 'true';

    // Price range
    if (minPrice || maxPrice) {
      searchCriteria.price = {};
      if (minPrice) searchCriteria.price.$gte = Number(minPrice);
      if (maxPrice) searchCriteria.price.$lte = Number(maxPrice);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const cars = await Car.find(searchCriteria)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Car.countDocuments(searchCriteria);
    const carsFormatted = cars.map(car => formatCarData(car));

    console.log(`✅ ${cars.length} cars found with search criteria`);

    res.status(200).json({
      success: true,
      data: carsFormatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('❌ SEARCH CARS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching cars'
    });
  }
};

// @desc    Get car statistics
// @route   GET /api/cars/stats
// @access  Public
exports.getCarStats = async (req, res) => {
  try {
    console.log('📊 Getting car statistics');

    const totalCars = await Car.countDocuments();
    const availableCars = await Car.countDocuments({ available: true });
    const featuredCars = await Car.countDocuments({ featured: true });

    const mostExpensiveCar = await Car.findOne()
      .sort({ price: -1 })
      .select('name brand price slug thumbnail images');

    const topRatedCar = await Car.findOne()
      .sort({ rating: -1, reviews: -1 })
      .select('name brand rating reviews slug thumbnail images');

    const statsByType = await Car.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          avgRating: { $avg: '$rating' }
        }
      },
      {
        $project: {
          type: '$_id',
          _id: 0,
          count: 1,
          avgPrice: { $round: ['$avgPrice', 2] },
          avgRating: { $round: ['$avgRating', 1] }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const statsByFuel = await Car.aggregate([
      {
        $group: {
          _id: '$specs.fuel',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          fuel: '$_id',
          _id: 0,
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const stats = {
      overview: {
        total: totalCars,
        available: availableCars,
        unavailable: totalCars - availableCars,
        featured: featuredCars
      },
      highlights: {
        mostExpensive: mostExpensiveCar ? formatCarData(mostExpensiveCar) : null,
        topRated: topRatedCar ? formatCarData(topRatedCar) : null
      },
      breakdown: {
        byType: statsByType,
        byFuel: statsByFuel
      }
    };
    console.log('✅ Statistics retrieved successfully');
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ GET CAR STATS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics'
    });
  }
};

// @desc    Get cars by type
// @route   GET /api/cars/type/:type
// @access  Public
exports.getCarsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    console.log(`🔍 Getting cars by type: ${type}`);

    const cars = await Car.find({ 
      type: type,
      available: true 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Car.countDocuments({ 
      type: type,
      available: true 
    });

    const carsFormatted = cars.map(car => formatCarData(car));

    console.log(`✅ ${cars.length} cars found for type: ${type}`);

    res.status(200).json({
      success: true,
      data: carsFormatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('❌ GET CARS BY TYPE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving cars by type'
    });
  }
};

// @desc    Get cars by fuel type
// @route   GET /api/cars/fuel/:fuel
// @access  Public
exports.getCarsByFuel = async (req, res) => {
  try {
    const { fuel } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    console.log(`🔍 Getting cars by fuel: ${fuel}`);

    const cars = await Car.find({ 
      'specs.fuel': fuel,
      available: true 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Car.countDocuments({ 
      'specs.fuel': fuel,
      available: true 
    });

    const carsFormatted = cars.map(car => formatCarData(car));

    console.log(`✅ ${cars.length} cars found for fuel: ${fuel}`);

    res.status(200).json({
      success: true,
      data: carsFormatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('❌ GET CARS BY FUEL ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving cars by fuel type'
    });
  }
};

// @desc    Get popular cars (most reviewed)
// @route   GET /api/cars/popular
// @access  Public
exports.getPopularCars = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    console.log('🔍 Getting popular cars');

    const cars = await Car.find({ 
      available: true,
      reviews: { $gt: 0 }
    })
      .sort({ reviews: -1, rating: -1 })
      .limit(Number(limit));

    const carsFormatted = cars.map(car => formatCarData(car));

    console.log(`✅ ${cars.length} popular cars found`);

    res.status(200).json({
      success: true,
      data: carsFormatted,
      count: cars.length
    });
  } catch (error) {
    console.error('❌ GET POPULAR CARS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving popular cars'
    });
  }
};