const Car = require('../models/Car');
const fs = require('fs').promises;
const path = require('path');

// Helper pour supprimer les fichiers d'images
const deleteImageFiles = async (filenames) => {
    try {
        const deletePromises = filenames.map(async (filename) => {
            const filePath = path.join(__dirname, '../uploads/cars', filename);
            try {
                await fs.access(filePath);
                await fs.unlink(filePath);
                console.log(`Fichier supprimé: ${filename}`);
            } catch (error) {
                console.log(`Fichier non trouvé: ${filename}`);
            }
        });

        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Erreur lors de la suppression des fichiers:', error);
        throw error;
    }
};

// @desc    Récupérer toutes les voitures
// @route   GET /api/cars
// @access  Public
const getAllCars = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            type,
            brand,
            minPrice,
            maxPrice,
            available,
            featured,
            search
        } = req.query;

        // Construction du filtre
        let filter = {};

        if (type) filter.type = type;
        if (brand) filter.brand = new RegExp(brand, 'i');
        if (available !== undefined) filter.available = available === 'true';
        if (featured !== undefined) filter.featured = featured === 'true';

        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const cars = await Car.find(filter)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await Car.countDocuments(filter);

        res.json({
            success: true,
            data: cars,
            count: cars.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des voitures:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des voitures',
            error: error.message
        });
    }
};

// @desc    Récupérer une voiture par ID
// @route   GET /api/cars/:id
// @access  Public
const getCarById = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);

        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Voiture non trouvée'
            });
        }

        res.json({
            success: true,
            data: car
        });

    } catch (error) {
        console.error('Erreur lors de la récupération de la voiture:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Voiture non trouvée'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

// @desc    Récupérer une voiture par slug
// @route   GET /api/cars/slug/:slug
// @access  Public
const getCarBySlug = async (req, res) => {
    try {
        const car = await Car.findOne({ slug: req.params.slug });

        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Voiture non trouvée'
            });
        }

        res.json({
            success: true,
            data: car
        });

    } catch (error) {
        console.error('Erreur lors de la récupération de la voiture:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

// @desc    Créer une nouvelle voiture
// @route   POST /api/cars
// @access  Private/Admin
const createCar = async (req, res) => {
    try {
        console.log('=== 🚗 CREATE CAR START ===');
        console.log('📦 Request body:', req.body);
        console.log('📁 Files:', req.files ? req.files.map(f => f.filename) : 'No files');

        // Vérification des droits administrateur
        if (req.user && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé. Droits administrateur requis.'
            });
        }

        const {
            name,
            brand,
            type,
            price,
            description,
            available = true,
            featured = false,
            rating = 5.0,
            reviews = 0,
            specs,
            primaryImageIndex = 0
        } = req.body;

        // Validation des champs obligatoires
        const requiredFields = { name, brand, type, price, description };
        const missingFields = Object.entries(requiredFields)
            .filter(([key, value]) => !value || value.toString().trim() === '')
            .map(([key]) => key);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Champs obligatoires manquants',
                missingFields,
                details: `Les champs suivants sont requis: ${missingFields.join(', ')}`
            });
        }

        // Validation du prix
        const priceNumber = Number(price);
        if (isNaN(priceNumber) || priceNumber <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Le prix doit être un nombre positif'
            });
        }

        // Parser les spécifications
        let parsedSpecs;
        try {
            parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : (specs || {});
        } catch (parseError) {
            console.error('❌ Specs parsing error:', parseError);
            return res.status(400).json({
                success: false,
                message: 'Format des spécifications invalide',
                error: parseError.message
            });
        }

        // Validation des spécifications avec valeurs par défaut
        const defaultSpecs = {
            seats: 5,
            fuel: 'Petrol',
            transmission: 'Automatic'
        };

        const validatedSpecs = {
            seats: Math.max(1, Math.min(50, Number(parsedSpecs.seats) || defaultSpecs.seats)),
            fuel: ['Petrol', 'Diesel', 'Electric', 'Hybrid'].includes(parsedSpecs.fuel) 
                ? parsedSpecs.fuel 
                : defaultSpecs.fuel,
            transmission: ['Automatic', 'Manual'].includes(parsedSpecs.transmission)
                ? parsedSpecs.transmission
                : defaultSpecs.transmission
        };

        // Validation des valeurs numériques
        const validatedRating = Math.min(5, Math.max(0, Number(rating) || 5.0));
        const validatedReviews = Math.max(0, Number(reviews) || 0);

        // Préparer les données de la voiture
        const carData = {
            name: name.trim(),
            brand: brand.trim(),
            type: type,
            price: Math.round(priceNumber),
            description: description.trim(),
            available: available === 'true' || available === true,
            featured: featured === 'true' || featured === true,
            rating: validatedRating,
            reviews: validatedReviews,
            specs: validatedSpecs
        };

        console.log('✅ Car data prepared:', carData);

        // Gérer les images uploadées
        if (req.files && req.files.length > 0) {
            const primaryIdx = parseInt(primaryImageIndex) || 0;
            const validPrimaryIndex = Math.min(primaryIdx, req.files.length - 1);
            
            carData.images = req.files.map((file, index) => ({
                filename: file.filename,
                alt: `${carData.name} - Image ${index + 1}`,
                isPrimary: index === validPrimaryIndex
            }));

            console.log('📸 Images processed:', carData.images);
        } else {
            // Si aucune image n'est fournie, retourner une erreur
            return res.status(400).json({
                success: false,
                message: 'Au moins une image est requise pour créer une voiture'
            });
        }

        // Créer et sauvegarder la voiture
        const car = new Car(carData);
        await car.save();

        console.log('✅ Car created successfully:', car._id);

        // Populer la réponse avec les données fraîches
        const savedCar = await Car.findById(car._id);
        
        res.status(201).json({
            success: true,
            message: 'Voiture créée avec succès',
            data: savedCar
        });

    } catch (error) {
        console.error('❌ CREATE CAR ERROR:', error);
        
        // Supprimer les fichiers uploadés en cas d'erreur
        if (req.files && req.files.length > 0) {
            const filenames = req.files.map(file => file.filename);
            console.log('🗑️ Cleaning up uploaded files:', filenames);
            await deleteImageFiles(filenames).catch(cleanupError => {
                console.error('❌ File cleanup error:', cleanupError);
            });
        }

        // Gestion des erreurs MongoDB
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            return res.status(400).json({
                success: false,
                message: 'Erreur de validation des données',
                errors
            });
        }

        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            const value = error.keyValue[field];
            return res.status(400).json({
                success: false,
                message: 'Doublon détecté',
                error: `Une voiture avec ce ${field} (${value}) existe déjà`
            });
        }

        // Erreur de base de données
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            return res.status(500).json({
                success: false,
                message: 'Erreur de base de données',
                error: error.message
            });
        }

        // Erreur générique
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la voiture',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
        });
    } finally {
        console.log('=== 🏁 CREATE CAR END ===');
    }
};

// @desc    Mettre à jour une voiture
// @route   PUT /api/cars/:id
// @access  Private/Admin
const updateCar = async (req, res) => {
    try {
        console.log('=== 🔄 UPDATE CAR START ===');
        console.log('📦 Request params:', req.params);
        console.log('📦 Request body:', req.body);
        console.log('📁 Files:', req.files ? req.files.map(f => f.filename) : 'No files');

        // Vérification des droits administrateur
        if (req.user && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé. Droits administrateur requis.'
            });
        }

        const car = await Car.findById(req.params.id);

        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Voiture non trouvée',
                carId: req.params.id
            });
        }

        console.log('✅ Car found:', car._id);

        const {
            name,
            brand,
            type,
            price,
            description,
            available,
            featured,
            rating,
            reviews,
            specs,
            primaryImageIndex,
            imagesToDelete
        } = req.body;

        // Mettre à jour les champs de base avec validation
        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Le nom ne peut pas être vide'
                });
            }
            car.name = name.trim();
        }

        if (brand !== undefined) {
            if (!brand.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'La marque ne peut pas être vide'
                });
            }
            car.brand = brand.trim();
        }

        if (type !== undefined) {
            if (!['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Truck'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Type de voiture invalide'
                });
            }
            car.type = type;
        }

        if (price !== undefined) {
            const priceNumber = Number(price);
            if (isNaN(priceNumber) || priceNumber <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Le prix doit être un nombre positif'
                });
            }
            car.price = Math.round(priceNumber);
        }

        if (description !== undefined) {
            if (!description.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'La description ne peut pas être vide'
                });
            }
            car.description = description.trim();
        }

        if (available !== undefined) {
            car.available = available === 'true' || available === true;
        }

        if (featured !== undefined) {
            car.featured = featured === 'true' || featured === true;
        }

        if (rating !== undefined) {
            const ratingNumber = Number(rating);
            if (isNaN(ratingNumber) || ratingNumber < 0 || ratingNumber > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'La note doit être un nombre entre 0 et 5'
                });
            }
            car.rating = Math.min(5, Math.max(0, ratingNumber));
        }

        if (reviews !== undefined) {
            const reviewsNumber = Number(reviews);
            if (isNaN(reviewsNumber) || reviewsNumber < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Le nombre d\'avis ne peut pas être négatif'
                });
            }
            car.reviews = Math.max(0, reviewsNumber);
        }

        // Mettre à jour les spécifications
        if (specs) {
            let parsedSpecs;
            try {
                parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : specs;
            } catch (parseError) {
                console.error('❌ Specs parsing error:', parseError);
                return res.status(400).json({
                    success: false,
                    message: 'Format des spécifications invalide',
                    error: parseError.message
                });
            }

            if (parsedSpecs.seats !== undefined) {
                const seatsNumber = Number(parsedSpecs.seats);
                if (isNaN(seatsNumber) || seatsNumber < 1 || seatsNumber > 50) {
                    return res.status(400).json({
                        success: false,
                        message: 'Le nombre de places doit être entre 1 et 50'
                    });
                }
                car.specs.seats = Math.max(1, Math.min(50, seatsNumber));
            }

            if (parsedSpecs.fuel !== undefined) {
                if (!['Petrol', 'Diesel', 'Electric', 'Hybrid'].includes(parsedSpecs.fuel)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Type de carburant invalide'
                    });
                }
                car.specs.fuel = parsedSpecs.fuel;
            }

            if (parsedSpecs.transmission !== undefined) {
                if (!['Automatic', 'Manual'].includes(parsedSpecs.transmission)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Type de transmission invalide'
                    });
                }
                car.specs.transmission = parsedSpecs.transmission;
            }
        }

        // Gérer les images à supprimer
        if (imagesToDelete) {
            let imagesToDeleteArray;
            try {
                imagesToDeleteArray = typeof imagesToDelete === 'string' 
                    ? JSON.parse(imagesToDelete) 
                    : imagesToDelete;
            } catch (parseError) {
                console.error('❌ imagesToDelete parsing error:', parseError);
                return res.status(400).json({
                    success: false,
                    message: 'Format des images à supprimer invalide'
                });
            }

            if (Array.isArray(imagesToDeleteArray) && imagesToDeleteArray.length > 0) {
                console.log('🗑️ Deleting images:', imagesToDeleteArray);
                
                // Supprimer les fichiers physiques
                await deleteImageFiles(imagesToDeleteArray);
                
                // Supprimer les images de la base de données
                const initialImageCount = car.images.length;
                car.images = car.images.filter(img => !imagesToDeleteArray.includes(img.filename));
                console.log(`✅ Images deleted: ${initialImageCount - car.images.length}`);
            }
        }

        // Ajouter les nouvelles images
        if (req.files && req.files.length > 0) {
            const totalExistingImages = car.images.length;
            const primaryIdx = parseInt(primaryImageIndex) || 0;
            
            // Valider que l'index principal est valide
            const totalImagesAfterAdd = totalExistingImages + req.files.length;
            const validPrimaryIndex = Math.min(Math.max(0, primaryIdx), totalImagesAfterAdd - 1);
            
            const newImages = req.files.map((file, index) => ({
                filename: file.filename,
                alt: `${car.name} - Image ${totalExistingImages + index + 1}`,
                isPrimary: (totalExistingImages + index) === validPrimaryIndex
            }));

            car.images.push(...newImages);
            console.log(`✅ ${newImages.length} new images added`);
        }

        // Réorganiser les images primaires si nécessaire
        if (primaryImageIndex !== undefined) {
            const primaryIdx = parseInt(primaryImageIndex);
            if (isNaN(primaryIdx) || primaryIdx < 0 || primaryIdx >= car.images.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Index de l\'image principale invalide'
                });
            }

            car.images.forEach((img, index) => {
                img.isPrimary = index === primaryIdx;
            });
            console.log(`⭐ Primary image set to index: ${primaryIdx}`);
        }

        // Valider qu'il reste au moins une image
        if (car.images.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Au moins une image est requise pour la voiture'
            });
        }

        // S'assurer qu'une seule image est marquée comme primaire
        const primaryImages = car.images.filter(img => img.isPrimary);
        if (primaryImages.length !== 1) {
            // Si aucune ou plusieurs images primaires, définir la première comme primaire
            car.images.forEach((img, index) => {
                img.isPrimary = index === 0;
            });
            console.log('🔄 Auto-corrected primary image to index 0');
        }

        await car.save();
        console.log('✅ Car updated successfully:', car._id);

        // Récupérer la voiture fraîchement mise à jour
        const updatedCar = await Car.findById(car._id);

        res.json({
            success: true,
            message: 'Voiture mise à jour avec succès',
            data: updatedCar
        });

    } catch (error) {
        console.error('❌ UPDATE CAR ERROR:', error);
        
        // Supprimer les nouveaux fichiers uploadés en cas d'erreur
        if (req.files && req.files.length > 0) {
            const filenames = req.files.map(file => file.filename);
            console.log('🗑️ Cleaning up uploaded files due to error:', filenames);
            await deleteImageFiles(filenames).catch(cleanupError => {
                console.error('❌ File cleanup error:', cleanupError);
            });
        }

        // Gestion des erreurs MongoDB
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            return res.status(400).json({
                success: false,
                message: 'Erreur de validation des données',
                errors
            });
        }

        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            const value = error.keyValue[field];
            return res.status(400).json({
                success: false,
                message: 'Doublon détecté',
                error: `Une voiture avec ce ${field} (${value}) existe déjà`
            });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'ID de voiture invalide'
            });
        }

        // Erreur générique
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de la voiture',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
        });
    } finally {
        console.log('=== 🏁 UPDATE CAR END ===');
    }
};

// @desc    Supprimer une voiture
// @route   DELETE /api/cars/:id
// @access  Private/Admin
const deleteCar = async (req, res) => {
    try {
        console.log('=== 🗑️ DELETE CAR START ===');
        console.log('📦 Request params:', req.params);
        
        // Vérification des droits administrateur
        if (req.user && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé. Droits administrateur requis.'
            });
        }

        // Validation de l'ID
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de voiture invalide',
                carId: req.params.id
            });
        }

        const car = await Car.findById(req.params.id);

        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Voiture non trouvée',
                carId: req.params.id
            });
        }

        console.log('✅ Car found for deletion:', {
            id: car._id,
            name: car.name,
            brand: car.brand,
            imageCount: car.images ? car.images.length : 0
        });

        // Vérifier s'il y a des réservations associées à cette voiture
        try {
            const Booking = require('../models/Booking');
            const activeBookings = await Booking.find({
                car: car._id,
                status: { $in: ['pending', 'confirmed', 'active'] }
            });

            if (activeBookings.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Impossible de supprimer la voiture',
                    error: `Cette voiture a ${activeBookings.length} réservation(s) active(s). Veuillez annuler les réservations avant de supprimer la voiture.`,
                    activeBookings: activeBookings.length
                });
            }
        } catch (bookingError) {
            console.warn('⚠️ Could not check bookings (model might not exist):', bookingError.message);
            // Continuer la suppression même si on ne peut pas vérifier les réservations
        }

        // Supprimer les fichiers d'images
        if (car.images && car.images.length > 0) {
            const filenames = car.images.map(img => img.filename);
            console.log('🗑️ Deleting image files:', filenames);
            
            try {
                await deleteImageFiles(filenames);
                console.log(`✅ Successfully deleted ${filenames.length} image file(s)`);
            } catch (fileError) {
                console.error('❌ Error deleting image files:', fileError);
                // Continuer la suppression même si les fichiers images ne peuvent pas être supprimés
                // On log l'erreur mais on ne bloque pas la suppression de la voiture
            }
        } else {
            console.log('ℹ️ No images to delete for this car');
        }

        // Supprimer la voiture de la base de données
        const deletionResult = await Car.findByIdAndDelete(req.params.id);
        
        if (!deletionResult) {
            // Ce cas ne devrait normalement pas se produire car on a déjà vérifié l'existence
            return res.status(404).json({
                success: false,
                message: 'Voiture non trouvée lors de la suppression',
                carId: req.params.id
            });
        }

        console.log('✅ Car deleted successfully from database');

        // Optionnel: Nettoyer les réservations associées (si elles existent)
        try {
            const Booking = require('../models/Booking');
            const deletedBookings = await Booking.deleteMany({ car: req.params.id });
            if (deletedBookings.deletedCount > 0) {
                console.log(`✅ Deleted ${deletedBookings.deletedCount} associated booking(s)`);
            }
        } catch (cleanupError) {
            console.warn('⚠️ Could not clean up associated bookings:', cleanupError.message);
        }

        res.json({
            success: true,
            message: 'Voiture supprimée avec succès',
            data: {
                carId: req.params.id,
                carName: car.name,
                brand: car.brand,
                deletedImages: car.images ? car.images.length : 0
            }
        });

    } catch (error) {
        console.error('❌ DELETE CAR ERROR:', error);
        
        // Gestion spécifique des erreurs MongoDB
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'ID de voiture invalide',
                error: 'Le format de l\'ID est incorrect'
            });
        }

        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            // Erreurs spécifiques à MongoDB
            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'Erreur de duplication',
                    error: error.message
                });
            }
            
            return res.status(500).json({
                success: false,
                message: 'Erreur de base de données',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur lors de l\'opération de base de données'
            });
        }

        // Vérifier les erreurs de réseau/timeout
        if (error.name === 'MongoTimeoutError' || error.message.includes('timeout')) {
            return res.status(503).json({
                success: false,
                message: 'Timeout de la base de données',
                error: 'La base de données met trop de temps à répondre. Veuillez réessayer.'
            });
        }

        // Erreur de système de fichiers (suppression d'images)
        if (error.code && error.code.startsWith('ENOENT') || error.message.includes('ENOENT')) {
            console.warn('⚠️ File system error (files may not exist):', error.message);
            // On continue car les fichiers peuvent avoir déjà été supprimés
            // On renvoie quand même un succès mais avec un avertissement
            return res.json({
                success: true,
                message: 'Voiture supprimée (certains fichiers images n\'ont pas pu être supprimés)',
                warning: 'Certains fichiers images associés n\'existaient pas'
            });
        }

        // Erreur générique
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la voiture',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur',
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    } finally {
        console.log('=== 🏁 DELETE CAR END ===');
    }
};

// @desc    Récupérer les voitures en vedette
// @route   GET /api/cars/featured
// @access  Public
const getFeaturedCars = async (req, res) => {
    try {
        const cars = await Car.find({ featured: true, available: true })
            .limit(6)
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: cars,
            count: cars.length
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des voitures en vedette:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

// @desc    Récupérer les types de voitures disponibles
// @route   GET /api/cars/types
// @access  Public
const getCarTypes = async (req, res) => {
    try {
        const types = await Car.distinct('type', { available: true });
        
        res.json({
            success: true,
            data: types
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des types:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

module.exports = {
    getAllCars,
    getCarById,
    getCarBySlug,
    createCar,
    updateCar,
    deleteCar,
    getFeaturedCars,
    getCarTypes
};