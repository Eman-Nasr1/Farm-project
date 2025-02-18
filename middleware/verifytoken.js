const jwt = require('jsonwebtoken');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

const verifytoken = (req, res, next) => {
  const authtoken = req.headers['authorization'];

  if (!authtoken) {
    const error = AppError.create('Token is required', 401, httpstatustext.ERROR);
    return next(error);
  }

  const token = authtoken.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    // Attach user information to the request object
    req.user = {
      id: decoded.id || decoded.userId, // Use `id` or `userId` based on the token type
      email: decoded.email,
      role: decoded.role || (decoded.userId ? 'employee' : 'user'), // Default to 'user' if role is not provided
      permissions: decoded.permissions || [],
      isAdmin: decoded.role === 'admin' // Set a flag for admin users
    };
console.log("requser:",req.user);
   // console.log('Decoded User:', req.user); // Log the decoded user for debugging

    next();
  } catch (err) {
    const error = AppError.create('Token is invalid', 401, httpstatustext.ERROR);
    return next(error);
  }
};

module.exports = verifytoken;