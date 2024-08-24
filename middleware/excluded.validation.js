// middleware/excludedValidation.js  

const { body, validationResult } = require('express-validator');  

const excludedValidationRules = () => {  
    return [  
        body('tagId')  
            .notEmpty().withMessage('Tag ID is required')  
            .isString().withMessage('Tag ID must be a string'),  
        body('weight')  
            .optional()  
            .isNumeric().withMessage('Weight must be a number')  
            .isFloat({ min: 0 }).withMessage('Weight must be a positive number'),  
        body('excludedType')  
            .notEmpty().withMessage('Excluded type is required')  
            .isIn(['death', 'sweep', 'sale']).withMessage('Excluded type must be one of death, sweep, sale'),  
        body('Date')  
            .optional()  
            .isISO8601().withMessage('Date must be a valid date'),  
        body('price')  
            .optional()  
            .isNumeric().withMessage('Price must be a number')  
            .isFloat({ min: 0 }).withMessage('Price must be a positive number'),  
        
    ];  
};  

const validateExcluded = (req, res, next) => {  
    const errors = validationResult(req);  
    if (!errors.isEmpty()) {  
        return res.status(400).json({ errors: errors.array() });  
    }  
    next();  
};  

module.exports = {  
    excludedValidationRules,  
    validateExcluded  
};