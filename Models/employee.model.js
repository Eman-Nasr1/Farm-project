const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const EmployeeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true, // Link to the parent user
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate: [validator.isEmail, 'Field must be a valid email address'],
    },
    password: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['employee', 'manager'],
        default: 'employee',
    },
    permissions: {
        type: [String], // Array of permissions like ["read", "write", "update"]
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

EmployeeSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 7);
    }
    next();
});

module.exports = mongoose.model('Employee', EmployeeSchema);
