const Car = require('../models/Car');
const fs = require('fs').promises;
const path = require('path');

// Helper function to create image objects with proper file handling
const createImageObject = (file, isPrimary = false) => ({
  url: file.filename,
  filename: file.filename,
  path: path.join('uploads', file.filename),
  alt: file.originalname || '',
  isPrimary: isPrimary,
  size: file.size || 0,
  mimetype: file.mimetype || 'image/jpeg'
});

// Helper function to add full URLs to car data
const addImageUrls = (car) => {
  const carObj = car.toObject ? car.toObject() : car;
  
  // Process images with full URLs
  const processedImages = carObj.images.map(img => ({
    ...img,
    url: `/uploads/${img.url}`
  }));

  // Find primary image
  const primaryImg = processedImages.find(img => img.isPrimary) || processedImages[0];
  const primaryImageUrl = primaryImg ? primaryImg.url : null;

  // Process thumbnail
  const thumbnailUrl = carObj.thumbnail && carObj.thumbnail.url 
    ? `/uploads/${carObj.thumbnail.url}`
    : primaryImageUrl;

  return {
    ...carObj,
    images: processedImages,
    primaryImage: primaryImageUrl,
    thumbnailUrl: thumbnailUrl
  };
};

// @desc    Create a new car
exports.createCar = async (req, res) => {
  try {
    console.log('=== START CREATE CAR ===');
    console.log('📦 Request body:', req.body);
    
    const { 
      name, brand, rating, reviews, available, 
      featured, type, price, description,
      seats, fuel, transmission,
      primaryImageIndex
    } = req.body;

    const carData = {
      name,
      brand,
      available: available === 'true' || available === true,
      featured: featured === 'true' || featured === true,
      type,
      price: Number(price),
      description: description || '',
      rating: Number(rating) || 5.0,
      reviews: Number(reviews) || 0,
      specs: {
        seats: Number(seats) || 5,
        fuel: fuel || 'Petrol',
        transmission: transmission || 'Automatic',
      },
      images: []
    };

    // Handle files
    if (req.files && req.files.images && req.files.images.length > 0) {
      const primaryIndex = primaryImageIndex !== undefined && !isNaN(Number(primaryImageIndex)) 
        ? Number(primaryImageIndex) 
        : 0;
        
      carData.images = req.files.images.map((file, index) => {
        return createImageObject(file, index === primaryIndex);
      });
      console.log(`✅ ${carData.images.length} images processed. Primary image index set to: ${primaryIndex}`);
    } else {
      console.log('❌ No image files received');
      return res.status(400).json({ 
        success: false,
        message: 'At least one image is required' 
      });
    }

    console.log('💾 Final car data:', carData);
    const car = await Car.create(carData);
    
    console.log('✅ Car created successfully - ID:', car._id);
    
    // Return car with full URLs
    const carWithUrls = addImageUrls(car);
    
    res.status(201).json({
      success: true,
      data: carWithUrls,
      message: 'Car created successfully'
    });
    
  } catch (error) {
    console.error('❌ CREATE CAR ERROR:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Error: A car with this name and brand already exists.' 
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed, please check your data.', 
        errors: error.errors 
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
exports.getCars = async (req, res) => {
  try {
    console.log('📋 Getting all cars');
    const cars = await Car.find({}).sort({ createdAt: -1 });
    const carsWithFullUrls = cars.map(car => addImageUrls(car));
    
    console.log(`✅ ${cars.length} cars retrieved`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls,
      count: cars.length
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
exports.getCarBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`🔍 Searching for car with slug: ${slug}`);
    
    const car = await Car.findOne({ slug });
    if (car) {
      const carWithFullUrls = addImageUrls(car);
      console.log(`✅ Car found: ${car.brand} ${car.name}`);
      res.status(200).json({
        success: true,
        data: carWithFullUrls
      });
    } else {
      console.log(`❌ Car not found with slug: ${slug}`);
      res.status(404).json({
        success: false,
        message: 'Car not found with this slug'
      });
    }
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
exports.getCarById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Searching for car with ID: ${id}`);
    
    const car = await Car.findById(id);
    if (!car) {
      console.log(`❌ Car not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }
    
    const carWithFullUrls = addImageUrls(car);
    console.log(`✅ Car found: ${car.brand} ${car.name}`);
    res.status(200).json({
      success: true,
      data: carWithFullUrls
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
exports.updateCar = async (req, res) => {
  try {
    console.log('=== START UPDATE CAR ===');
    const car = await Car.findById(req.params.id);
    if (!car) {
      console.log(`❌ Car not found with ID: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    const { 
      name, brand, type, price, description, featured, 
      seats, fuel, transmission, available, imagesToDelete, 
      rating, reviews,
      primaryImageIndex
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
      const imagesToDeleteArray = Array.isArray(imagesToDelete) ? imagesToDelete : [imagesToDelete];
      console.log('🗑️ Images to delete:', imagesToDeleteArray);
      
      const initialImageCount = car.images.length;
      car.images = car.images.filter(img => {
        return !imagesToDeleteArray.includes(img.filename);
      });
      console.log(`🗑️ Images after deletion: ${initialImageCount} → ${car.images.length}`);
      
      // Delete physical files asynchronously and in parallel
      const deletePromises = imagesToDeleteArray.map(filename => {
        const filePath = path.join(__dirname, '../uploads', filename);
        return fs.unlink(filePath).catch(err => {
          console.error(`Error deleting file ${filename}:`, err.message);
        });
      });
      await Promise.all(deletePromises);
    }

    // Handle new files
    if (req.files && req.files.images) {
      const newImages = req.files.images.map(file => createImageObject(file));
      car.images.push(...newImages);
      console.log(`✅ Added ${newImages.length} new images`);
    }

    // Handle primary image selection
    if (primaryImageIndex !== undefined) {
      console.log(`⭐ Setting primary image with index: ${primaryImageIndex}`);
      
      // Reset all images as non-primary
      car.images.forEach(img => img.isPrimary = false);
      
      // Set the new primary image
      const primaryIndex = parseInt(primaryImageIndex);
      if (car.images[primaryIndex]) {
        car.images[primaryIndex].isPrimary = true;
        console.log(`✅ Primary image set to index: ${primaryIndex}`);
      }
    }

    // Ensure there's always a primary image (fallback)
    if (car.images.length > 0 && !car.images.some(img => img.isPrimary)) {
      car.images[0].isPrimary = true;
      console.log('⭐ Set first image as primary (fallback)');
    }

    // Save will trigger the pre-save hooks for slug and thumbnail
    const updatedCar = await car.save();
    
    const carWithFullUrls = addImageUrls(updatedCar);
    
    console.log('✅ Car updated successfully - ID:', updatedCar._id);
    res.status(200).json({
      success: true,
      data: carWithFullUrls,
      message: 'Car updated successfully'
    });
    
  } catch (error) {
    console.error('❌ UPDATE CAR ERROR:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Error: A car with this name and brand already exists.' 
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid validation data', 
        errors: error.errors 
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
exports.deleteCar = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting car with ID: ${id}`);

    const car = await Car.findById(id);
    if (!car) {
      console.log(`❌ Car not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    // Delete associated files
    const filesToDelete = car.images?.map(img => img.filename).filter(Boolean) || [];
    console.log('🗑️ Files to delete:', filesToDelete);

    // Delete physical files asynchronously and in parallel
    const deletePromises = filesToDelete.map(filename => {
      const filePath = path.join(__dirname, '../uploads', filename);
      return fs.unlink(filePath).catch(err => {
        console.error(`Error deleting file ${filename}:`, err.message);
      });
    });
    await Promise.all(deletePromises);

    await Car.findByIdAndDelete(id);
    
    console.log(`✅ Car deleted successfully - ID: ${id}`);
    res.status(200).json({
      success: true,
      message: 'Car deleted successfully',
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

// The rest of your controller functions remain the same...
// (getRelatedCars, getAvailableCars, getFeaturedCars, searchCars, getCarStats)

// @desc    Get related cars
exports.getRelatedCars = async (req, res) => {
  try {
    const { type, currentCarSlug } = req.params;
    console.log(`🔍 Searching for related cars - Type: ${type}, Current slug: ${currentCarSlug}`);
    
    const cars = await Car.find({
      type: type,
      slug: { $ne: currentCarSlug },
      available: true
    }).limit(3);
    
    const carsWithFullUrls = cars.map(car => addImageUrls(car));
    
    console.log(`✅ ${cars.length} related cars found`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls
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
exports.getAvailableCars = async (req, res) => {
  try {
    console.log('🔍 Getting available cars');
    const cars = await Car.find({ available: true }).sort({ createdAt: -1 });
    const carsWithFullUrls = cars.map(car => addImageUrls(car));
    
    console.log(`✅ ${cars.length} available cars found`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls,
      count: cars.length
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
exports.getFeaturedCars = async (req, res) => {
  try {
    console.log('🔍 Getting featured cars');
    const cars = await Car.find({ 
      featured: true, 
      available: true 
    }).sort({ createdAt: -1 }).limit(6);
    
    const carsWithFullUrls = cars.map(car => addImageUrls(car));
    
    console.log(`✅ ${cars.length} featured cars found`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls,
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
exports.searchCars = async (req, res) => {
  try {
    const { query, type, fuel, transmission, minPrice, maxPrice } = req.query;
    console.log('🔍 Searching cars with filters:', req.query);
    
    let searchCriteria = { available: true };
    
    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (type) searchCriteria.type = type;
    if (fuel) searchCriteria['specs.fuel'] = fuel;
    if (transmission) searchCriteria['specs.transmission'] = transmission;
    
    if (minPrice || maxPrice) {
      searchCriteria.price = {};
      if (minPrice) searchCriteria.price.$gte = Number(minPrice);
      if (maxPrice) searchCriteria.price.$lte = Number(maxPrice);
    }
    
    const cars = await Car.find(searchCriteria).sort({ createdAt: -1 });
    const carsWithFullUrls = cars.map(car => addImageUrls(car));
    
    console.log(`✅ ${cars.length} cars found with search`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls,
      count: cars.length
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
exports.getCarStats = async (req, res) => {
  try {
    console.log('📊 Getting car statistics');
    
    const totalCars = await Car.countDocuments();
    const availableCars = await Car.countDocuments({ available: true });
    const featuredCars = await Car.countDocuments({ featured: true });
    
    const mostExpensiveCar = await Car.findOne().sort({ price: -1 }).select('name brand price');
    const topRatedCar = await Car.findOne().sort({ rating: -1 }).select('name brand rating');
    
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
          _id: 1,
          count: 1,
          avgPrice: { $round: ["$avgPrice", 2] },
          avgRating: { $round: ["$avgRating", 1] }
        }
      }
    ]);
    
    const stats = {
      total: totalCars,
      available: availableCars,
      unavailable: totalCars - availableCars,
      featured: featuredCars,
      mostExpensive: mostExpensiveCar,
      topRated: topRatedCar,
      byType: statsByType
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