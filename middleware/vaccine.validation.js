// middleware/vaccineValidation.js  

const { body, validationResult } = require('express-validator');  

const vaccineValidationRules = () => {  
    return [  
        body('vaccineName')  
            .notEmpty().withMessage('Vaccine name is required')  
            .isString().withMessage('Vaccine name must be a string'),  

        body('givenEvery')  
            .notEmpty().withMessage('Given Every must be specified')  
            .isInt({ min: 1 }).withMessage('Given Every must be a positive integer'),  

        body('vaccinationLog.*.tagId')  
        .optional() 
            .isString().withMessage('Tag ID must be a string'),  

        body('vaccinationLog.*.DateGiven')  
            .notEmpty().withMessage('Date Given is required')  
            .isISO8601().withMessage('Date Given must be a valid date')  ,
         
        // body('vaccinationLog.*.locationShed')  
        //     .optional()  
        //     .isString().withMessage('Location Shed must be a string'),  

       

    
    ];  
};  

const validateVaccine = (req, res, next) => {  
    const errors = validationResult(req);  
    if (!errors.isEmpty()) {  
        return res.status(400).json({ errors: errors.array() });  
    }  
    next();  
};  

module.exports = {  
    vaccineValidationRules,  
    validateVaccine  
};