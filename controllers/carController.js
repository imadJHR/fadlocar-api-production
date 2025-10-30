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
    console.log('=== DÉBUT CREATE CAR ===');
    console.log('📦 Corps de la requête:', req.body);
    console.log('📎 Fichiers reçus:', req.files ? Object.keys(req.files) : 'Aucun fichier');

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
      transmission
    } = req.body;

    // Validation des champs requis
    if (!name || !brand || !type || !price) {
      return res.status(400).json({ 
        success: false,
        message: 'Les champs name, brand, type et price sont obligatoires' 
      });
    }

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
      slug: slugify(`${brand}-${name}-${Date.now()}`),
      specs: {
        seats: Number(seats) || 5,
        fuel: fuel || 'Petrol',
        transmission: transmission || 'Automatic',
      },
      images: []
    };

    // Gestion des fichiers
    if (req.files) {
      console.log('📁 Détail des fichiers reçus:');
      
      // Thumbnail
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        const thumbnailFile = req.files.thumbnail[0];
        carData.thumbnail = thumbnailFile.filename;
        console.log('🖼️  Thumbnail:', {
          originalName: thumbnailFile.originalname,
          filename: thumbnailFile.filename,
          path: thumbnailFile.path,
          size: thumbnailFile.size,
          mimetype: thumbnailFile.mimetype
        });
        
        // Vérifier que le fichier est bien créé
        const fileExists = fs.existsSync(thumbnailFile.path);
        console.log('📁 Thumbnail sauvegardé sur le disque?', fileExists);
      }
      
      // Images supplémentaires
      if (req.files.images) {
        carData.images = req.files.images.map(file => {
          console.log('🖼️  Image supplémentaire:', {
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size
          });
          
          // Vérifier que le fichier est bien créé
          const fileExists = fs.existsSync(file.path);
          console.log('📁 Image sauvegardée sur le disque?', fileExists);
          
          return file.filename;
        });
      }
      
      // Vérification finale que la thumbnail existe
      if (!carData.thumbnail) {
        return res.status(400).json({ 
          success: false,
          message: 'La thumbnail est obligatoire pour créer une nouvelle voiture' 
        });
      }
    } else {
      console.log('❌ Aucun fichier reçu dans req.files');
      return res.status(400).json({ 
        success: false,
        message: 'Au moins une image (thumbnail) est requise' 
      });
    }

    console.log('💾 Données finales de la voiture:', carData);
    const car = await Car.create(carData);
    
    console.log('✅ Voiture créée avec succès - ID:', car._id);
    
    // Retourner la voiture avec les URLs complètes
    const carWithUrls = {
      ...car.toObject(),
      thumbnail: `/uploads/${car.thumbnail}`,
      images: car.images.map(img => `/uploads/${img}`)
    };
    
    res.status(201).json({
      success: true,
      data: carWithUrls,
      message: 'Voiture créée avec succès'
    });
    
  } catch (error) {
    console.error('❌ ERREUR CREATE CAR:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Erreur : Une voiture avec ce nom et cette marque existe déjà.' 
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Données de validation invalides', 
        errors: error.errors 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la création de la voiture', 
      error: error.message 
    });
  }
};

// @desc    Obtenir toutes les voitures
exports.getCars = async (req, res) => {
  try {
    console.log('📋 Récupération de toutes les voitures');
    const cars = await Car.find({}).sort({ createdAt: -1 });
    
    // Ajouter l'URL complète pour les images
    const carsWithFullUrls = cars.map(car => ({
      ...car.toObject(),
      thumbnail: car.thumbnail ? `/uploads/${car.thumbnail}` : null,
      images: car.images.map(img => `/uploads/${img}`)
    }));
    
    console.log(`✅ ${cars.length} voitures récupérées`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls,
      count: cars.length
    });
  } catch (error) {
    console.error('❌ ERREUR GET CARS:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de la récupération des voitures', 
      error: error.message 
    });
  }
};

// @desc    Obtenir une voiture par Slug
exports.getCarBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`🔍 Recherche de la voiture avec le slug: ${slug}`);
    
    const car = await Car.findOne({ slug });
    if (car) {
      // Ajouter l'URL complète pour les images
      const carWithFullUrls = {
        ...car.toObject(),
        thumbnail: car.thumbnail ? `/uploads/${car.thumbnail}` : null,
        images: car.images.map(img => `/uploads/${img}`)
      };
      
      console.log(`✅ Voiture trouvée: ${car.brand} ${car.name}`);
      res.status(200).json({
        success: true,
        data: carWithFullUrls
      });
    } else {
      console.log(`❌ Voiture non trouvée avec le slug: ${slug}`);
      res.status(404).json({
        success: false,
        message: 'Voiture non trouvée avec ce slug'
      });
    }
  } catch (error) {
    console.error('❌ ERREUR GET CAR BY SLUG:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur', 
      error: error.message 
    });
  }
};

// @desc    Obtenir une voiture par ID
exports.getCarById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Recherche de la voiture avec l'ID: ${id}`);
    
    const car = await Car.findById(id);
    if (!car) {
      console.log(`❌ Voiture non trouvée avec l'ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Voiture non trouvée'
      });
    }
    
    // Ajouter l'URL complète pour les images
    const carWithFullUrls = {
      ...car.toObject(),
      thumbnail: car.thumbnail ? `/uploads/${car.thumbnail}` : null,
      images: car.images.map(img => `/uploads/${img}`)
    };
    
    console.log(`✅ Voiture trouvée: ${car.brand} ${car.name}`);
    res.status(200).json({
      success: true,
      data: carWithFullUrls
    });
  } catch (error) {
    console.error('❌ ERREUR GET CAR BY ID:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur', 
      error: error.message 
    });
  }
};

// @desc    Mettre à jour une voiture
exports.updateCar = async (req, res) => {
  try {
    console.log('=== DÉBUT UPDATE CAR ===');
    console.log('📦 Corps de la requête:', req.body);
    console.log('📎 Fichiers reçus:', req.files ? Object.keys(req.files) : 'Aucun fichier');

    const car = await Car.findById(req.params.id);
    if (!car) {
      console.log(`❌ Voiture non trouvée avec l'ID: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Voiture non trouvée'
      });
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
      reviews
    } = req.body;

    console.log('🔄 Mise à jour des champs...');

    // Mise à jour des champs de base
    if (name !== undefined) {
      car.name = name;
      console.log('✏️  Nom mis à jour:', name);
    }
    if (brand !== undefined) {
      car.brand = brand;
      console.log('✏️  Marque mise à jour:', brand);
    }
    if (type !== undefined) {
      car.type = type;
      console.log('✏️  Type mis à jour:', type);
    }
    if (price !== undefined) {
      car.price = Number(price);
      console.log('✏️  Prix mis à jour:', price);
    }
    if (description !== undefined) {
      car.description = description;
      console.log('✏️  Description mise à jour');
    }
    if (rating !== undefined) {
      car.rating = Number(rating);
      console.log('✏️  Rating mis à jour:', rating);
    }
    if (reviews !== undefined) {
      car.reviews = Number(reviews);
      console.log('✏️  Reviews mis à jour:', reviews);
    }
    
    // Mise à jour des specs
    if (seats !== undefined) {
      car.specs.seats = Number(seats);
      console.log('✏️  Sièges mis à jour:', seats);
    }
    if (fuel !== undefined) {
      car.specs.fuel = fuel;
      console.log('✏️  Carburant mis à jour:', fuel);
    }
    if (transmission !== undefined) {
      car.specs.transmission = transmission;
      console.log('✏️  Transmission mise à jour:', transmission);
    }
    
    // Mise à jour du slug si le nom ou la marque change
    if (name || brand) {
      car.slug = slugify(`${car.brand}-${car.name}-${car._id}`);
      console.log('✏️  Slug mis à jour:', car.slug);
    }

    // Mise à jour des champs booléens
    if (available !== undefined) {
      car.available = available === 'true' || available === true;
      console.log('✏️  Disponibilité mise à jour:', car.available);
    }
    if (featured !== undefined) {
      car.featured = featured === 'true' || featured === true;
      console.log('✏️  Featured mis à jour:', car.featured);
    }

    // Gestion de la suppression d'images
    if (imagesToDelete) {
      const imagesToDeleteArray = Array.isArray(imagesToDelete) ? imagesToDelete : [imagesToDelete];
      console.log('🗑️  Images à supprimer:', imagesToDeleteArray);
      
      // Filtrer les images à supprimer
      const initialImageCount = car.images.length;
      car.images = car.images.filter(img => !imagesToDeleteArray.includes(img));
      console.log(`🗑️  Images après suppression: ${initialImageCount} → ${car.images.length}`);
      
      // Supprimer les fichiers physiques
      imagesToDeleteArray.forEach(filename => {
        const filePath = path.join(__dirname, '../uploads', filename);
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`❌ Erreur suppression fichier ${filename}:`, err);
            } else {
              console.log(`✅ Fichier supprimé: ${filename}`);
            }
          });
        } else {
          console.log(`⚠️  Fichier non trouvé, suppression ignorée: ${filename}`);
        }
      });
    }

    // Gestion des nouveaux fichiers
    if (req.files) {
      console.log('📁 Traitement des nouveaux fichiers...');
      
      // Mettre à jour la thumbnail
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        const newThumbnail = req.files.thumbnail[0];
        console.log('🖼️  Nouvelle thumbnail:', {
          filename: newThumbnail.filename,
          path: newThumbnail.path
        });
        
        // Supprimer l'ancienne thumbnail si elle existe
        if (car.thumbnail) {
          const oldThumbnailPath = path.join(__dirname, '../uploads', car.thumbnail);
          if (fs.existsSync(oldThumbnailPath)) {
            fs.unlink(oldThumbnailPath, err => {
              if (err) {
                console.error(`❌ Erreur suppression ancienne thumbnail ${car.thumbnail}:`, err);
              } else {
                console.log(`✅ Ancienne thumbnail supprimée: ${car.thumbnail}`);
              }
            });
          }
        }
        car.thumbnail = newThumbnail.filename;
        console.log('✅ Thumbnail mise à jour:', car.thumbnail);
      }
      
      // Ajouter de nouvelles images
      if (req.files.images) {
        const newImageFilenames = req.files.images.map(file => {
          console.log('🖼️  Nouvelle image:', {
            filename: file.filename,
            path: file.path
          });
          return file.filename;
        });
        car.images.push(...newImageFilenames);
        console.log(`✅ ${newImageFilenames.length} nouvelles images ajoutées`);
      }
    }

    const updatedCar = await car.save();
    
    // Ajouter les URLs complètes pour la réponse
    const carWithFullUrls = {
      ...updatedCar.toObject(),
      thumbnail: updatedCar.thumbnail ? `/uploads/${updatedCar.thumbnail}` : null,
      images: updatedCar.images.map(img => `/uploads/${img}`)
    };
    
    console.log('✅ Voiture mise à jour avec succès - ID:', updatedCar._id);
    res.status(200).json({
      success: true,
      data: carWithFullUrls,
      message: 'Voiture mise à jour avec succès'
    });
    
  } catch (error) {
    console.error('❌ ERREUR UPDATE CAR:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Erreur : Une voiture avec ce nom et cette marque existe déjà.' 
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Données de validation invalides', 
        errors: error.errors 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la mise à jour de la voiture', 
      error: error.message 
    });
  }
};

// @desc    Supprimer une voiture
exports.deleteCar = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️  Suppression de la voiture avec l'ID: ${id}`);

    const car = await Car.findById(id);
    if (!car) {
      console.log(`❌ Voiture non trouvée avec l'ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Voiture non trouvée'
      });
    }

    // Supprimer les fichiers associés
    const filesToDelete = [];
    
    if (car.thumbnail) {
      filesToDelete.push(car.thumbnail);
    }
    
    if (car.images && car.images.length > 0) {
      filesToDelete.push(...car.images);
    }

    console.log('🗑️  Fichiers à supprimer:', filesToDelete);

    // Supprimer les fichiers physiques
    filesToDelete.forEach(filename => {
      const filePath = path.join(__dirname, '../uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`❌ Erreur suppression fichier ${filename}:`, err);
          } else {
            console.log(`✅ Fichier supprimé: ${filename}`);
          }
        });
      } else {
        console.log(`⚠️  Fichier non trouvé, suppression ignorée: ${filename}`);
      }
    });

    await Car.findByIdAndDelete(id);
    
    console.log(`✅ Voiture supprimée avec succès - ID: ${id}`);
    res.status(200).json({
      success: true,
      message: 'Voiture supprimée avec succès',
      deletedCarId: id
    });
    
  } catch (error) {
    console.error('❌ ERREUR DELETE CAR:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la suppression de la voiture', 
      error: error.message 
    });
  }
};

// @desc    Obtenir les voitures similaires
exports.getRelatedCars = async (req, res) => {
  try {
    const { type, currentCarSlug } = req.params;
    console.log(`🔍 Recherche de voitures similaires - Type: ${type}, Slug actuel: ${currentCarSlug}`);
    
    const cars = await Car.find({
      type: type,
      slug: { $ne: currentCarSlug },
      available: true
    }).limit(3);
    
    // Ajouter les URLs complètes pour les images
    const carsWithFullUrls = cars.map(car => ({
      ...car.toObject(),
      thumbnail: car.thumbnail ? `/uploads/${car.thumbnail}` : null,
      images: car.images.map(img => `/uploads/${img}`)
    }));
    
    console.log(`✅ ${cars.length} voitures similaires trouvées`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls
    });
  } catch (error) {
    console.error('❌ ERREUR GET RELATED CARS:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur', 
      error: error.message 
    });
  }
};

// @desc    Obtenir les voitures disponibles
exports.getAvailableCars = async (req, res) => {
  try {
    console.log('🔍 Récupération des voitures disponibles');
    const cars = await Car.find({ available: true }).sort({ createdAt: -1 });
    
    // Ajouter les URLs complètes pour les images
    const carsWithFullUrls = cars.map(car => ({
      ...car.toObject(),
      thumbnail: car.thumbnail ? `/uploads/${car.thumbnail}` : null,
      images: car.images.map(img => `/uploads/${img}`)
    }));
    
    console.log(`✅ ${cars.length} voitures disponibles trouvées`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls,
      count: cars.length
    });
  } catch (error) {
    console.error('❌ ERREUR GET AVAILABLE CARS:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des voitures disponibles', 
      error: error.message 
    });
  }
};

// @desc    Obtenir les voitures featured
exports.getFeaturedCars = async (req, res) => {
  try {
    console.log('🔍 Récupération des voitures en vedette');
    const cars = await Car.find({ 
      featured: true, 
      available: true 
    }).sort({ createdAt: -1 }).limit(6);
    
    // Ajouter les URLs complètes pour les images
    const carsWithFullUrls = cars.map(car => ({
      ...car.toObject(),
      thumbnail: car.thumbnail ? `/uploads/${car.thumbnail}` : null,
      images: car.images.map(img => `/uploads/${img}`)
    }));
    
    console.log(`✅ ${cars.length} voitures en vedette trouvées`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls,
      count: cars.length
    });
  } catch (error) {
    console.error('❌ ERREUR GET FEATURED CARS:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des voitures en vedette', 
      error: error.message 
    });
  }
};

// @desc    Rechercher des voitures
exports.searchCars = async (req, res) => {
  try {
    const { query, type, fuel, transmission, minPrice, maxPrice } = req.query;
    console.log('🔍 Recherche de voitures avec filtres:', req.query);
    
    let searchCriteria = { available: true };
    
    // Recherche par texte
    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }
    
    // Filtres supplémentaires
    if (type) searchCriteria.type = type;
    if (fuel) searchCriteria['specs.fuel'] = fuel;
    if (transmission) searchCriteria['specs.transmission'] = transmission;
    
    // Filtre par prix
    if (minPrice || maxPrice) {
      searchCriteria.price = {};
      if (minPrice) searchCriteria.price.$gte = Number(minPrice);
      if (maxPrice) searchCriteria.price.$lte = Number(maxPrice);
    }
    
    const cars = await Car.find(searchCriteria).sort({ createdAt: -1 });
    
    // Ajouter les URLs complètes pour les images
    const carsWithFullUrls = cars.map(car => ({
      ...car.toObject(),
      thumbnail: car.thumbnail ? `/uploads/${car.thumbnail}` : null,
      images: car.images.map(img => `/uploads/${img}`)
    }));
    
    console.log(`✅ ${cars.length} voitures trouvées avec la recherche`);
    res.status(200).json({
      success: true,
      data: carsWithFullUrls,
      count: cars.length
    });
  } catch (error) {
    console.error('❌ ERREUR SEARCH CARS:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la recherche des voitures', 
      error: error.message 
    });
  }
};

// @desc    Obtenir les statistiques des voitures
exports.getCarStats = async (req, res) => {
  try {
    console.log('📊 Récupération des statistiques des voitures');
    
    const totalCars = await Car.countDocuments();
    const availableCars = await Car.countDocuments({ available: true });
    const featuredCars = await Car.countDocuments({ featured: true });
    const unavailableCars = totalCars - availableCars;
    
    // Obtenir la voiture la plus chère
    const mostExpensiveCar = await Car.findOne().sort({ price: -1 });
    
    // Obtenir la voiture la mieux notée
    const topRatedCar = await Car.findOne().sort({ rating: -1 });
    
    // Statistiques par type
    const statsByType = await Car.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);
    
    const stats = {
      total: totalCars,
      available: availableCars,
      unavailable: unavailableCars,
      featured: featuredCars,
      mostExpensive: mostExpensiveCar ? {
        name: mostExpensiveCar.name,
        brand: mostExpensiveCar.brand,
        price: mostExpensiveCar.price
      } : null,
      topRated: topRatedCar ? {
        name: topRatedCar.name,
        brand: topRatedCar.brand,
        rating: topRatedCar.rating
      } : null,
      byType: statsByType
    };
    
    console.log('✅ Statistiques récupérées avec succès');
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ ERREUR GET CAR STATS:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des statistiques', 
      error: error.message 
    });
  }
};