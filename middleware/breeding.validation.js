// middleware/breedingValidation.js  

const { body, validationResult } = require('express-validator');  

const breedingValidationRules = () => {  
    return [  
        body('tagId')  
            .notEmpty().withMessage('Tag ID is required')  
            .isString().withMessage('Tag ID must be a string'),  
        body('deliveryState')  
            .optional()  
            .isString().withMessage('Delivery state must be a string'),  
        body('deliveryDate')  
            .notEmpty().withMessage('Delivery date is required')  ,
            
        body('numberOfBriths')  
            .optional()  
            .isNumeric().withMessage('Number of births must be a number')  
            .isInt({ min: 0 }).withMessage('Number of births must be a positive integer'),  
        body('birthEntries.*.tagId')  
            .notEmpty().withMessage('Tag ID is required for each birth entry')  
            .isString().withMessage('Tag ID must be a string'),  
        body('birthEntries.*.gender')  
            .notEmpty().withMessage('Gender is required for each birth entry')  
            .isIn(['male', 'female']).withMessage('Gender must be either male or female'),  
        body('birthEntries.*.birthweight')  
            .optional()  
            .isNumeric().withMessage('Birth weight must be a number')  
            .isFloat({ min: 0 }).withMessage('Birth weight must be a positive number'),  
  
    ];  
};  

const validateBreeding = (req, res, next) => {  
    const errors = validationResult(req);  
    if (!errors.isEmpty()) {  
        return res.status(400).json({ errors: errors.array() });  
    }  
    next();  
};  

module.exports = {  
    breedingValidationRules,  
    validateBreeding  
};