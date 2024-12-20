const jwt = require('jsonwebtoken');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

const protectEmployee = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return next(AppError.create('Authorization token is required', 401, httpstatustext.FAIL));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.employee = decoded; // Attach employee data to the request object
        next();
    } catch (err) {
        return next(AppError.create('Invalid or expired token', 401, httpstatustext.FAIL));
    }
};

module.exports = protectEmployee;
