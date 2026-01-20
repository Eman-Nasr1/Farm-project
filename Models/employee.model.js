const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const EmployeeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true, // Tenant ID (Owner)
        // Index handled by compound index below
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        validate: [validator.isEmail, 'Field must be a valid email address'],
        // Removed global unique - now using compound unique index per tenant
    },
    password: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    roleIds: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role',
        }],
        default: [],
    },
    extraPermissions: {
        type: [String],
        default: [],
    },
    deniedPermissions: {
        type: [String],
        default: [],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

// Compound unique index: email must be unique per tenant
// Note: This also serves as an index on { user: 1 } for faster tenant queries
EmployeeSchema.index({ user: 1, email: 1 }, { unique: true });

EmployeeSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 7);
    }
    next();
});

module.exports = mongoose.model('Employee', EmployeeSchema);
