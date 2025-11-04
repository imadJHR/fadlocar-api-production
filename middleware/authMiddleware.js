const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Récupérer l'utilisateur avec le rôle
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Utilisateur non trouvé' 
                });
            }
            
            next();
        } catch (error) {
            console.error('Token verification error:', error);
            return res.status(401).json({ 
                success: false,
                message: 'Token invalide' 
            });
        }
    } else {
        return res.status(401).json({ 
            success: false,
            message: 'Token manquant' 
        });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ 
            success: false,
            message: 'Accès refusé. Droits administrateur requis.' 
        });
    }
};

module.exports = { protect, admin };