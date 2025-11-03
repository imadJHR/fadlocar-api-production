const Car = require('../models/Car');
const fs = require('fs').promises;
const path = require('path');

// Helper function to get base URL from request
const getBaseUrl = (req) => {
  return `${req.protocol}://${req.get('host')}`;
};

// Helper function to create image objects from Multer files
const createImageObject = (file, baseUrl, isPrimary = false) => ({
  url: `${baseUrl}/uploads/${file.filename}`,
  filename: file.filename,
  path: file.path,
  alt: file.originalname || '',
  isPrimary: isPrimary,
  size: file.size || 0,
  mimetype: file.mimetype || 'image/jpeg'
});

// Helper function to format car data with full URLs
const formatCarData = (car, baseUrl) => {
  const carObj = car.toObject ? car.toObject() : car;
  
  // Ensure images have full URLs
  const images = carObj.images.map(img => ({
    ...img,
    url: img.url.startsWith('http') ? img.url : `${baseUrl}${img.url}`
  }));

  // Find primary image
  const primaryImg = images.find(img => img.isPrimary) || images[0];

  // Format thumbnail
  const thumbnail = carObj.thumbnail && carObj.thumbnail.url 
    ? {
        ...carObj.thumbnail,
        url: carObj.thumbnail.url.startsWith('http') 
          ? carObj.thumbnail.url 
          : `${baseUrl}${carObj.thumbnail.url}`
      }
    : primaryImg 
      ? { url: primaryImg.url, filename: primaryImg.filename, path: primaryImg.path }
      : null;

  return {
    ...carObj,
    images,
    thumbnail,
    primaryImage: primaryImg || null,
    thumbnailUrl: thumbnail ? thumbnail.url : null
  };
};

// @desc    Create a new car
// @route   POST /api/cars
// @access  Private (Admin)
exports.createCar = async (req, res) => {
  try {
    console.log('=== START CREATE CAR ===');
    console.log('📦 Request body:', req.body);
    console.log('📁 Files:', req.files);
    
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

    // Validate images
    if (!req.files || !req.files.images || req.files.images.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one image is required' 
      });
    }

    const baseUrl = getBaseUrl(req);
    const primaryIndex = primaryImageIndex !== undefined && !isNaN(Number(primaryImageIndex)) 
      ? Number(primaryImageIndex) 
      : 0;

    // Process uploaded images
    const images = req.files.images.map((file, index) => 
      createImageObject(file, baseUrl, index === primaryIndex)
    );

    // Create car data
    const carData = {
      name,
      brand,
      available: available === 'true' || available === true,
      featured: featured === 'true' || featured === true,
      type: type || 'Sedan',
      price: Number(price),
      description,
      rating: rating ? Number(rating) : 5.0,
      reviews: reviews ? Number(reviews) : 0,
      specs: {
        seats: seats ? Number(seats) : 5,
        fuel: fuel || 'Petrol',
        transmission: transmission || 'Automatic',
      },
      images
    };

    console.log(`✅ Processing ${images.length} images. Primary: index ${primaryIndex}`);

    // Create car
    const car = await Car.create(carData);
    console.log('✅ Car created successfully - ID:', car._id);
    
    // Format response with full URLs
    const formattedCar = formatCarData(car, baseUrl);
    
    res.status(201).json({
      success: true,
      data: formattedCar,
      message: 'Car created successfully'
    });
    
  } catch (error) {
    console.error('❌ CREATE CAR ERROR:', error);
    
    // Delete uploaded files on error
    if (req.files && req.files.images) {
      const deletePromises = req.files.images.map(file => 
        fs.unlink(file.path).catch(err => 
          console.error(`Error deleting file ${file.filename}:`, err.message)
        )
      );
      await Promise.all(deletePromises);
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
    res.status(500).json({ 
      success: false,
      message: 'Error creating car', 
      error: error.message 
    });
  }
};

// @desc    Get all cars
// @route   GET /api/cars
// @access  Public
exports.getCars = async (req, res) => {
  try {
    console.log('📋 Getting all cars');
    
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const cars = await Car.find({})
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Car.countDocuments();
    const baseUrl = getBaseUrl(req);
    const carsFormatted = cars.map(car => formatCarData(car, baseUrl));
    
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
      message: 'Server error while retrieving cars', 
      error: error.message 
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
    
    const baseUrl = getBaseUrl(req);
    const formattedCar = formatCarData(car, baseUrl);
    
    console.log(`✅ Car found: ${car.brand} ${car.name}`);
    
    res.status(200).json({
      success: true,
      data: formattedCar
    });
  } catch (error) {
    console.error('❌ GET CAR BY SLUG ERROR:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
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
    
    const baseUrl = getBaseUrl(req);
    const formattedCar = formatCarData(car, baseUrl);
    
    console.log(`✅ Car found: ${car.brand} ${car.name}`);
    
    res.status(200).json({
      success: true,
      data: formattedCar
    });
  } catch (error) {
    console.error('❌ GET CAR BY ID ERROR:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// @desc    Update a car
// @route   PUT /api/cars/:id
// @access  Private (Admin)
exports.updateCar = async (req, res) => {
  try {
    console.log('=== START UPDATE CAR ===');
    console.log('📦 Request body:', req.body);
    console.log('📁 Files:', req.files);
    
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
    if (name !== undefined) car.name = name;
    if (brand !== undefined) car.brand = brand;
    if (type !== undefined) car.type = type;
    if (price !== undefined) car.price = Number(price);
    if (description !== undefined) car.description = description;
    if (rating !== undefined) car.rating = Number(rating);
    if (reviews !== undefined) car.reviews = Number(reviews);
    
    // Update specs
    if (seats !== undefined) car.specs.seats = Number(seats);
    if (fuel !== undefined) car.specs.fuel = fuel;
    if (transmission !== undefined) car.specs.transmission = transmission;
    
    // Update boolean fields
    if (available !== undefined) car.available = available === 'true' || available === true;
    if (featured !== undefined) car.featured = featured === 'true' || featured === true;

    // Handle image deletion
    if (imagesToDelete) {
      const imagesToDeleteArray = Array.isArray(imagesToDelete) 
        ? imagesToDelete 
        : JSON.parse(imagesToDelete);
      
      console.log('🗑️ Images to delete:', imagesToDeleteArray);
      
      const initialImageCount = car.images.length;
      
      // Filter out images to delete
      car.images = car.images.filter(img => 
        !imagesToDeleteArray.includes(img.filename)
      );
      
      console.log(`🗑️ Images: ${initialImageCount} → ${car.images.length}`);
      
      // Delete physical files
      const deletePromises = imagesToDeleteArray.map(filename => {
        const filePath = path.join(__dirname, '../uploads', filename);
        return fs.unlink(filePath).catch(err => {
          console.error(`Error deleting file ${filename}:`, err.message);
        });
      });
      await Promise.all(deletePromises);
    }

    // Handle new image uploads
    const baseUrl = getBaseUrl(req);
    
    if (req.files && req.files.images && req.files.images.length > 0) {
      const newImages = req.files.images.map(file => 
        createImageObject(file, baseUrl, false)
      );
      car.images.push(...newImages);
      console.log(`✅ Added ${newImages.length} new images`);
    }

    // Validate that at least one image exists
    if (car.images.length === 0) {
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

    // Save will trigger pre-save hooks for slug and thumbnail
    const updatedCar = await car.save();
    
    const formattedCar = formatCarData(updatedCar, baseUrl);
    
    console.log('✅ Car updated successfully - ID:', updatedCar._id);
    
    res.status(200).json({
      success: true,
      data: formattedCar,
      message: 'Car updated successfully'
    });
    
  } catch (error) {
    console.error('❌ UPDATE CAR ERROR:', error);
    
    // Delete newly uploaded files on error
    if (req.files && req.files.images) {
      const deletePromises = req.files.images.map(file => 
        fs.unlink(file.path).catch(err => 
          console.error(`Error deleting file ${file.filename}:`, err.message)
        )
      );
      await Promise.all(deletePromises);
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
    res.status(500).json({ 
      success: false,
      message: 'Error updating car', 
      error: error.message 
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

    // Delete associated image files
    const filesToDelete = car.images?.map(img => img.filename).filter(Boolean) || [];
    console.log(`🗑️ Deleting ${filesToDelete.length} image files`);

    const deletePromises = filesToDelete.map(filename => {
      const filePath = path.join(__dirname, '../uploads', filename);
      return fs.unlink(filePath).catch(err => {
        console.error(`Error deleting file ${filename}:`, err.message);
      });
    });
    await Promise.all(deletePromises);

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
      message: 'Error deleting car', 
      error: error.message 
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
    
    const baseUrl = getBaseUrl(req);
    const carsFormatted = cars.map(car => formatCarData(car, baseUrl));
    
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
      message: 'Server error', 
      error: error.message 
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
    const baseUrl = getBaseUrl(req);
    const carsFormatted = cars.map(car => formatCarData(car, baseUrl));
    
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
      message: 'Error retrieving available cars', 
      error: error.message 
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
    
    const baseUrl = getBaseUrl(req);
    const carsFormatted = cars.map(car => formatCarData(car, baseUrl));
    
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
      message: 'Error retrieving featured cars', 
      error: error.message 
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
    const baseUrl = getBaseUrl(req);
    const carsFormatted = cars.map(car => formatCarData(car, baseUrl));
    
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
      message: 'Error searching cars', 
      error: error.message 
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
      .select('name brand price slug');
      
    const topRatedCar = await Car.findOne()
      .sort({ rating: -1, reviews: -1 })
      .select('name brand rating reviews slug');
    
    const statsByType = await Car.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          avgRating: { $avg: '$rating' },
          totalCars: { $sum: 1 }
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
        mostExpensive: mostExpensiveCar,
        topRated: topRatedCar
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
      message: 'Error retrieving statistics', 
      error: error.message 
    });
  }
};