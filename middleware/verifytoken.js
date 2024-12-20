
const jwt=require('jsonwebtoken');
const AppError=require('../utilits/AppError');
const httpstatustext=require('../utilits/httpstatustext');

const verifytoken = (req, res, next) => {
  const authtoken = req.headers['authorization'];
  if (!authtoken) {
      const error = AppError.create('Token is required', 401, httpstatustext.ERROR);
      return next(error);
  }

  const token = authtoken.split(' ')[1];
  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      req.employeeId = decoded.employeeId; // Employee ID
      req.userId = decoded.userId; // Parent User ID
      req.role = decoded.role; // Role of the employee
      next();
  } catch {
      const error = AppError.create('Token is invalid', 401, httpstatustext.ERROR);
      return next(error);
  }
};


module.exports=verifytoken;