const Car = require('../models/Car');
const fs = require('fs').promises;
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

// Helper function to get base URL from request
const getBaseUrl = (req) => {
  return `${req.protocol}://${req.get('host')}`;
};

// Helper function to create image objects from Multer files
const createImageObject = (file, baseUrl, isPrimary = false) => ({
  url: `${baseUrl}/uploads/${file.filename}`,
  filename: file.filename,
  path: file.path,
  alt: file.originalname || `Car image ${file.filename}`,
  isPrimary: isPrimary,
  size: file.size || 0,
  mimetype: file.mimetype || 'image/jpeg'
});

// Helper function to format car data with full URLs
const formatCarData = (car, baseUrl) => {
  const carObj = car.toObject ? car.toObject() : { ...car };

  // Ensure images have full URLs and proper structure
  const images = (carObj.images || []).map(img => {
    let imageUrl = img.url;

    // If URL doesn't start with http, prepend baseUrl
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
    }

    return {
      _id: img._id || img.id,
      url: imageUrl,
      filename: img.filename,
      path: img.path,
      alt: img.alt || `Car image ${img.filename}`,
      isPrimary: img.isPrimary || false,
      size: img.size || 0,
      mimetype: img.mimetype || 'image/jpeg'
    };
  });

  // Find primary image
  const primaryImg = images.find(img => img.isPrimary) || images[0] || null;

  // Format thumbnail - ensure it has proper URL
  let thumbnail = null;
  if (carObj.thumbnail && carObj.thumbnail.url) {
    let thumbnailUrl = carObj.thumbnail.url;
    if (!thumbnailUrl.startsWith('http')) {
      thumbnailUrl = `${baseUrl}${thumbnailUrl.startsWith('/') ? '' : '/'}${thumbnailUrl}`;
    }
    thumbnail = {
      ...carObj.thumbnail,
      url: thumbnailUrl
    };
  } else if (primaryImg) {
    thumbnail = {
      url: primaryImg.url,
      filename: primaryImg.filename,
      path: primaryImg.path
    };
  }

  return {
    ...carObj,
    images,
    thumbnail,
    primaryImage: primaryImg,
    thumbnailUrl: thumbnail ? thumbnail.url : (primaryImg ? primaryImg.url : null)
  };
};

// Helper function to delete image files safely
const deleteImageFiles = async (filenames) => {
  if (!filenames || filenames.length === 0) return;

  const deletePromises = filenames.map(async (filename) => {
    try {
      const filePath = path.join(__dirname, '../uploads', filename);
      await fs.access(filePath); // Check if file exists
      await fs.unlink(filePath);
      console.log(`✅ Deleted file: ${filename}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`⚠️ File not found, skipping: ${filename}`);
      } else {
        console.error(`❌ Error deleting file ${filename}:`, error.message);
      }
    }
  });

  await Promise.all(deletePromises);
};

// Helper function to validate image files
const validateImageFiles = (files) => {
  if (!files || !files.images || files.images.length === 0) {
    throw new Error('At least one image is required');
  }

  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  for (const file of files.images) {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP`);
    }

    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.originalname}. Maximum size: 5MB`);
    }
  }
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

// ======================================================================
// 🟢 CREATE A NEW CAR
// @route POST /api/cars
// ======================================================================
exports.createCar = async (req, res) => {
  let uploadedFiles = [];

  try {
    console.log('=== START CREATE CAR ===');
    console.log('📦 Request body:', req.body);
    console.log('📁 Files:', req.files);

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
    if (req.files) {
      validateImageFiles(req.files);
    }

    const baseUrl = getBaseUrl(req);
    const primaryIndex = parseInt(primaryImageIndex) || 0;

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
      slug: slugify(`${brand}-${name}`),
      specs: {
        seats: seats ? Math.max(1, Math.min(50, Number(seats))) : 5,
        fuel: fuel || 'Petrol',
        transmission: transmission || 'Automatic',
      }
    };

    // Handle uploaded files
    if (req.files) {
      // Process uploaded images
      if (req.files.images && req.files.images.length > 0) {
        const images = req.files.images.map((file, index) =>
          createImageObject(file, baseUrl, index === primaryIndex)
        );
        uploadedFiles = images.map(img => img.filename);
        carData.images = images;
        console.log(`✅ Processing ${images.length} images. Primary: index ${primaryIndex}`);
      }

      // Handle thumbnail
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        carData.thumbnail = createImageObject(req.files.thumbnail[0], baseUrl, false);
      }
    }

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
    if (uploadedFiles.length > 0) {
      await deleteImageFiles(uploadedFiles);
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

// ======================================================================
// 🟢 GET ALL CARS
// @route GET /api/cars
// ======================================================================
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
      message: 'Server error while retrieving cars'
    });
  }
};

// ======================================================================
// 🟢 GET CAR BY SLUG
// @route GET /api/cars/slug/:slug
// ======================================================================
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
      message: 'Server error'
    });
  }
};

// ======================================================================
// 🟢 GET CAR BY ID
// @route GET /api/cars/:id
// ======================================================================
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
      message: 'Server error'
    });
  }
};

// ======================================================================
// 🟡 UPDATE CAR
// @route PUT /api/cars/:id
// ======================================================================
exports.updateCar = async (req, res) => {
  let newUploadedFiles = [];

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

    // Update slug if name or brand changed
    if (name !== undefined || brand !== undefined) {
      car.slug = slugify(`${car.brand}-${car.name}`);
    }

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

      console.log('🗑️ Images to delete:', imagesToDeleteArray);

      const initialImageCount = car.images.length;

      // Filter out images to delete and get their filenames
      const imagesToDeleteFilenames = car.images
        .filter(img => imagesToDeleteArray.includes(img.filename) || imagesToDeleteArray.includes(img._id.toString()))
        .map(img => img.filename);

      car.images = car.images.filter(img =>
        !imagesToDeleteArray.includes(img.filename) && !imagesToDeleteArray.includes(img._id.toString())
      );

      console.log(`🗑️ Images: ${initialImageCount} → ${car.images.length}`);

      // Delete physical files
      await deleteImageFiles(imagesToDeleteFilenames);
    }

    // Handle new image uploads
    const baseUrl = getBaseUrl(req);

    if (req.files && req.files.images && req.files.images.length > 0) {
      validateImageFiles(req.files);

      const newImages = req.files.images.map(file =>
        createImageObject(file, baseUrl, false)
      );
      newUploadedFiles = newImages.map(img => img.filename);
      car.images.push(...newImages);
      console.log(`✅ Added ${newImages.length} new images`);
    }

    // Handle thumbnail upload
    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      // Delete old thumbnail file if exists
      if (car.thumbnail && car.thumbnail.filename) {
        await deleteImageFiles([car.thumbnail.filename]);
      }
      
      car.thumbnail = createImageObject(req.files.thumbnail[0], baseUrl, false);
      console.log('✅ Thumbnail updated');
    }

    // Validate that at least one image exists
    if (car.images.length === 0 && !car.thumbnail) {
      // Delete newly uploaded files if no images remain
      if (newUploadedFiles.length > 0) {
        await deleteImageFiles(newUploadedFiles);
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
        if (car.images.length > 0) {
          car.images[0].isPrimary = true;
        }
      }
    }

    // Ensure there's always a primary image
    if (car.images.length > 0 && !car.images.some(img => img.isPrimary)) {
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
    if (newUploadedFiles.length > 0) {
      await deleteImageFiles(newUploadedFiles);
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

// ======================================================================
// 🔴 DELETE CAR
// @route DELETE /api/cars/:id
// ======================================================================
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
    if (car.thumbnail && car.thumbnail.filename) {
      filesToDelete.push(car.thumbnail.filename);
    }
    
    console.log(`🗑️ Deleting ${filesToDelete.length} image files`);

    await deleteImageFiles(filesToDelete);

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

// ======================================================================
// 🟢 GET RELATED CARS
// @route GET /api/cars/related/:type/:currentCarSlug
// ======================================================================
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
      message: 'Server error'
    });
  }
};

// Additional methods from the first version that might be useful
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
      message: 'Error retrieving available cars'
    });
  }
};

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
      message: 'Error retrieving featured cars'
    });
  }
};

exports.searchCars = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Search query is required' });

    const regex = new RegExp(q, 'i');
    const cars = await Car.find({
      $or: [
        { name: regex },
        { brand: regex },
        { description: regex },
        { type: regex }
      ]
    });

    const baseUrl = getBaseUrl(req);
    const formatted = cars.map(c => formatCarData(c, baseUrl));

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('❌ SEARCH CARS ERROR:', err);
    res.status(500).json({ success: false, message: 'Server error while searching cars' });
  }
};