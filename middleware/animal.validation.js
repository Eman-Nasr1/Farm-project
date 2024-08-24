// middleware/animalValidation.js  

const { body, validationResult } = require('express-validator');  

const animalValidationRules = () => {  
    return [  
        body('tagId')  
            .notEmpty().withMessage('Tag ID is required')  
            .isString().withMessage('Tag ID must be a string'),  
        body('breed')  
            .notEmpty().withMessage('Breed is required')  
            .isString().withMessage('Breed must be a string'),  
        body('animalType')  
            .notEmpty().withMessage('Animal type is required')  
            .isIn(['goat', 'sheep']).withMessage('Animal type must be either goat or sheep'),  
        body('birthDate')  
            .optional()  
            .isISO8601().withMessage('Birth date must be a valid date'),  
        body('purchaseData')  
            .optional()  
            .isISO8601().withMessage('Purchase date must be a valid date'),  
        body('purchasePrice')  
            .optional()  
            .isNumeric().withMessage('Purchase price must be a number'),  
        body('gender')  
            .notEmpty().withMessage('Gender is required')  
            .isIn(['male', 'female']).withMessage('Gender must be either male or female'),  
        body('Teething')  
            .optional()  
            .isIn(['two', 'four', 'six']).withMessage('Teething must be either two, four, or six'),  
        // Add more validations as needed  
    ];  
};  

const validateAnimal = (req, res, next) => {  
    const errors = validationResult(req);  
    if (!errors.isEmpty()) {  
        return res.status(400).json({ errors: errors.array() });  
    }  
    next();  
};  

module.exports = {  
    animalValidationRules,  
    validateAnimal  
};