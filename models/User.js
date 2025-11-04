// In your login controller
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Explicitly select password since it's hidden by default
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Use the new profile method
        res.json({
            ...user.toProfileJSON(),
            token: generateToken(user._id),
        });
    } catch (error) {
        // error handling
    }
};