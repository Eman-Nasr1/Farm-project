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

    // Check if the token belongs to a user or an employee
    if (decoded.userId) {
      // Employee token: Extract userId from employee's token
      req.userId = decoded.userId; // Parent user's ID
      req.role = 'employee';
      req.permissions = decoded.permissions || []; 
    } else {
      // User token: Use the user ID directly
      req.userId = decoded.id;
      req.role = 'user';
      req.permissions = []; 
    }

    req.currentuser = decoded;
    next();
  } catch (err) {
    const error = AppError.create('Token is invalid', 401, httpstatustext.ERROR);
    return next(error);
  }
};

module.exports = verifytoken;
