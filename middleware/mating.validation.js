// middleware/matingValidation.js  

const { body, validationResult } = require('express-validator');  

const matingValidationRules = () => {  
    return [  
        body('tagId')  
            .notEmpty().withMessage('Tag ID is required')  
            .isString().withMessage('Tag ID must be a string'),  
        body('maleTag_id')  
            .notEmpty().withMessage('Male Tag ID is required')  
            .isString().withMessage('Male Tag ID must be a string'),  
        body('matingType')  
            .notEmpty().withMessage('Mating Type is required')  
            .isString().withMessage('Mating Type must be a string'),  
        // body('matingDate')  
        //     .notEmpty().withMessage('Mating Date date is required') ,  
            
        body('sonarDate')  
            .notEmpty().withMessage('Mating Date date is required') ,  
             
        body('sonarRsult')  
            .optional()  
            .isIn(['positive', 'negative']).withMessage('Sonar Result must be either "positive" or "negative"'),  
        body('expectedDeliveryDate')  
            .optional()  
            .isISO8601().withMessage('Expected Delivery Date must be a valid date'),  
       
    ];  
};  

const validateMating = (req, res, next) => {  
    const errors = validationResult(req);  
    if (!errors.isEmpty()) {  
        return res.status(400).json({ errors: errors.array() });  
    }  
    next();  
};  

module.exports = {  
    matingValidationRules,  
    validateMating  
};