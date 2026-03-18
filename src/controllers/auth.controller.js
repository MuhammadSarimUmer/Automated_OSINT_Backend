const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { sendRegistrationEmail } = require('../services/email.service');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '3d' });
};

const sendTokenResponse = (user, statusCode, res) => {
    const token = generateToken(user._id);

    const options = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        // httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        token,
        user: { id: user._id, email: user.email }
    });
};

exports.register = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.create({ email, password });


        const name = email.split('@')[0];
        await sendRegistrationEmail(user.email, name);

        sendTokenResponse(user, 201, res);
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        sendTokenResponse(user, 200, res);
    } catch (error) {
        next(error);
    }
};

exports.logout = (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        // httpOnly: true
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
};