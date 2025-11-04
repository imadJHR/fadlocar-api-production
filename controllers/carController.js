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
            specs
        } = req.body;

        // Validation basique
        if (!name || !brand || !price || !description) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs obligatoires doivent être remplis'
            });
        }

        // Parser les spécifications si elles sont envoyées en string
        let parsedSpecs;
        try {
            parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : specs;
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                message: 'Format des spécifications invalide'
            });
        }

        // Validation des spécifications
        if (!parsedSpecs || !parsedSpecs.seats || !parsedSpecs.fuel || !parsedSpecs.transmission) {
            return res.status(400).json({
                success: false,
                message: 'Toutes les spécifications sont requises'
            });
        }

        // Préparer les données de la voiture
        const carData = {
            name: name.trim(),
            brand: brand.trim(),
            type,
            price: Math.round(Number(price)),
            description: description.trim(),
            available: available === 'true' || available === true,
            featured: featured === 'true' || featured === true,
            rating: Math.min(5, Math.max(0, Number(rating))),
            reviews: Math.max(0, Number(reviews)),
            specs: {
                seats: Math.max(1, Math.min(50, Number(parsedSpecs.seats))),
                fuel: parsedSpecs.fuel,
                transmission: parsedSpecs.transmission
            }
        };

        // Gérer les images uploadées
        if (req.files && req.files.length > 0) {
            const primaryImageIndex = parseInt(req.body.primaryImageIndex) || 0;
            
            carData.images = req.files.map((file, index) => ({
                filename: file.filename,
                alt: `${name} - Image ${index + 1}`,
                isPrimary: index === primaryImageIndex
            }));
        }

        const car = new Car(carData);
        await car.save();

        res.status(201).json({
            success: true,
            message: 'Voiture créée avec succès',
            data: car
        });

    } catch (error) {
        console.error('Erreur lors de la création de la voiture:', error);
        
        // Supprimer les fichiers uploadés en cas d'erreur
        if (req.files && req.files.length > 0) {
            const filenames = req.files.map(file => file.filename);
            await deleteImageFiles(filenames).catch(console.error);
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Erreur de validation',
                errors
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Une voiture avec ce nom existe déjà'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la voiture',
            error: error.message
        });
    }
};

// @desc    Mettre à jour une voiture
// @route   PUT /api/cars/:id
// @access  Private/Admin
const updateCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);

        if (!car) {
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
            available,
            featured,
            rating,
            reviews,
            specs
        } = req.body;

        // Mettre à jour les champs de base
        if (name) car.name = name.trim();
        if (brand) car.brand = brand.trim();
        if (type) car.type = type;
        if (price) car.price = Math.round(Number(price));
        if (description) car.description = description.trim();
        if (available !== undefined) car.available = available === 'true' || available === true;
        if (featured !== undefined) car.featured = featured === 'true' || featured === true;
        if (rating) car.rating = Math.min(5, Math.max(0, Number(rating)));
        if (reviews) car.reviews = Math.max(0, Number(reviews));

        // Mettre à jour les spécifications
        if (specs) {
            let parsedSpecs;
            try {
                parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : specs;
            } catch (parseError) {
                return res.status(400).json({
                    success: false,
                    message: 'Format des spécifications invalide'
                });
            }

            if (parsedSpecs.seats) car.specs.seats = Math.max(1, Math.min(50, Number(parsedSpecs.seats)));
            if (parsedSpecs.fuel) car.specs.fuel = parsedSpecs.fuel;
            if (parsedSpecs.transmission) car.specs.transmission = parsedSpecs.transmission;
        }

        // Gérer les images à supprimer
        if (req.body.imagesToDelete) {
            const imagesToDelete = typeof req.body.imagesToDelete === 'string' 
                ? JSON.parse(req.body.imagesToDelete) 
                : req.body.imagesToDelete;

            if (Array.isArray(imagesToDelete) && imagesToDelete.length > 0) {
                // Supprimer les fichiers physiques
                await deleteImageFiles(imagesToDelete);
                
                // Supprimer les images de la base de données
                car.images = car.images.filter(img => !imagesToDelete.includes(img.filename));
            }
        }

        // Ajouter les nouvelles images
        if (req.files && req.files.length > 0) {
            const primaryImageIndex = parseInt(req.body.primaryImageIndex) || 0;
            const totalExistingImages = car.images.length;
            
            const newImages = req.files.map((file, index) => ({
                filename: file.filename,
                alt: `${car.name} - Image ${totalExistingImages + index + 1}`,
                isPrimary: (totalExistingImages + index) === primaryImageIndex
            }));

            car.images.push(...newImages);
        }

        // Réorganiser les images primaires si nécessaire
        if (req.body.primaryImageIndex !== undefined) {
            const primaryIndex = parseInt(req.body.primaryImageIndex);
            car.images.forEach((img, index) => {
                img.isPrimary = index === primaryIndex;
            });
        }

        await car.save();

        res.json({
            success: true,
            message: 'Voiture mise à jour avec succès',
            data: car
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de la voiture:', error);
        
        // Supprimer les nouveaux fichiers uploadés en cas d'erreur
        if (req.files && req.files.length > 0) {
            const filenames = req.files.map(file => file.filename);
            await deleteImageFiles(filenames).catch(console.error);
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Erreur de validation',
                errors
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
// @route   DELETE /api/cars/:id
// @access  Private/Admin
const deleteCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);

        if (!car) {
            return res.status(404).json({
                success: false,
                message: 'Voiture non trouvée'
            });
        }

        // Supprimer les fichiers d'images
        if (car.images && car.images.length > 0) {
            const filenames = car.images.map(img => img.filename);
            await deleteImageFiles(filenames);
        }

        await Car.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Voiture supprimée avec succès'
        });

    } catch (error) {
        console.error('Erreur lors de la suppression de la voiture:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Voiture non trouvée'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la voiture',
            error: error.message
        });
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