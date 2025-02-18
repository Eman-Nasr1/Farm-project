const Employee = require('../Models/employee.model');
const User = require('../Models/user.model');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const bcrypt=require('bcryptjs');
const jwt =require('jsonwebtoken');

const createEmployee = asyncwrapper(async (req, res, next) => {
    const { name, email, password, phone, role, permissions } = req.body;
    const userId = req.user.id; // Assume you have middleware that provides the logged-in user ID

    // Ensure the user exists
    const user = await User.findById(userId);
    if (!user) {
        return next(AppError.create('User not found', 404, httpstatustext.ERROR));
    }

    // Check if the employee already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
        return next(AppError.create('Employee already exists', 400, httpstatustext.FAIL));
    }

    // Create the new employee
    const newEmployee = new Employee({
        user: user._id, // Link the employee to the user
        name,
        email,
        password,
        phone,
        role,
        permissions,
    });

    await newEmployee.save();

    res.status(201).json({
        status: httpstatustext.SUCCESS,
        data: { employee: newEmployee },
    });
});


const employeeLogin = asyncwrapper(async (req, res, next) => {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
        return next(AppError.create('Email and password are required', 400, httpstatustext.FAIL));
    }

    // Find the employee by email and populate the associated user
    const employee = await Employee.findOne({ email }).populate('user', 'role'); // Populate the user details

    if (!employee) {
        return next(AppError.create('Employee not found', 404, httpstatustext.ERROR));
    }

    // Check if the password is correct
    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid) {
        return next(AppError.create('Invalid password', 400, httpstatustext.ERROR));
    }

    // Create a JWT token for both the employee and the parent user
    const token = jwt.sign(
        { id: employee._id, role: employee.role, userId: employee.user._id ,permissions: employee.permissions}, // Include both employee and user info
        process.env.JWT_SECRET_KEY,
        { expiresIn: '30d' }
    );

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { token, user: employee.user }, // Return the parent user data
    });
});

module.exports = {
    createEmployee,
    employeeLogin,
};
