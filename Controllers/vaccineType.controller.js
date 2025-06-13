const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const VaccineType = require('../Models/vaccineType.model');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/vaccines';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload only images.'), false);
        }
    }
});

// Add a new vaccine type
const addVaccineType = asyncwrapper(async (req, res) => {
    const imageFile = req.file;
    const vaccineTypeData = {
        ...req.body,
        image: imageFile ? imageFile.path : null
    };

    const vaccineType = await VaccineType.create(vaccineTypeData);
    
    res.status(201).json({
        status: httpstatustext.SUCCESS,
        data: { vaccineType }
    });
});

// Get all vaccine types
const getAllVaccineTypes = asyncwrapper(async (req, res) => {
    const query = req.query;
    const limit = parseInt(query.limit) || 10;
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;

    let filter = {};
    if (query.diseaseType) {
        filter.diseaseType = { $regex: query.diseaseType, $options: 'i' };
    }
    if (query.search) {
        filter.$or = [
            { englishName: { $regex: query.search, $options: 'i' } },
            { arabicName: { $regex: query.search, $options: 'i' } }
        ];
    }

    const vaccineTypes = await VaccineType.find(filter)
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 });

    const total = await VaccineType.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
        status: httpstatustext.SUCCESS,
        data: { vaccineTypes },
        pagination: {
            currentPage: page,
            totalPages,
            totalItems: total,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    });
});

// Get a single vaccine type
const getVaccineType = asyncwrapper(async (req, res, next) => {
    const vaccineType = await VaccineType.findById(req.params.id);
    if (!vaccineType) {
        return next(new AppError('Vaccine type not found', 404));
    }

    res.json({
        status: httpstatustext.SUCCESS,
        data: { vaccineType }
    });
});

// Update a vaccine type
const updateVaccineType = asyncwrapper(async (req, res, next) => {
    const imageFile = req.file;
    const updateData = { ...req.body };

    if (imageFile) {
        updateData.image = imageFile.path;
        
        // Delete old image if exists
        const oldVaccineType = await VaccineType.findById(req.params.id);
        if (oldVaccineType?.image) {
            try {
                fs.unlinkSync(oldVaccineType.image);
            } catch (err) {
                console.error('Error deleting old image:', err);
            }
        }
    }

    const vaccineType = await VaccineType.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
    );

    if (!vaccineType) {
        return next(new AppError('Vaccine type not found', 404));
    }

    res.json({
        status: httpstatustext.SUCCESS,
        data: { vaccineType }
    });
});

// Delete a vaccine type
const deleteVaccineType = asyncwrapper(async (req, res, next) => {
    const vaccineType = await VaccineType.findById(req.params.id);
    
    if (!vaccineType) {
        return next(new AppError('Vaccine type not found', 404));
    }

    // Delete associated image if exists
    if (vaccineType.image) {
        try {
            fs.unlinkSync(vaccineType.image);
        } catch (err) {
            console.error('Error deleting image:', err);
        }
    }

    await vaccineType.deleteOne();

    res.json({
        status: httpstatustext.SUCCESS,
        message: 'Vaccine type deleted successfully'
    });
});

// Import vaccine types from Excel
const importVaccineTypes = asyncwrapper(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please upload an Excel file', 400));
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const results = {
        success: [],
        errors: []
    };

    for (let i = 0; i < data.length; i++) {
        try {
            const row = data[i];
            const vaccineType = await VaccineType.create({
                englishName: row.englishName,
                arabicName: row.arabicName,
                diseaseType: row.diseaseType,
                description: {
                    en: row.descriptionEn || '',
                    ar: row.descriptionAr || ''
                }
            });
            results.success.push({
                row: i + 2,
                vaccineType: vaccineType.arabicName
            });
        } catch (error) {
            results.errors.push({
                row: i + 2,
                error: error.message
            });
        }
    }

    res.status(201).json({
        status: httpstatustext.SUCCESS,
        data: results
    });
});

module.exports = {
    addVaccineType,
    getAllVaccineTypes,
    getVaccineType,
    updateVaccineType,
    deleteVaccineType,
    importVaccineTypes,
    upload
}; 