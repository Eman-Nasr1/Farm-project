// middleware/weightValidation.js  

const { body, validationResult } = require('express-validator');  

const weightValidationRules = () => {  
    return [  
        body('tagId')  
            .notEmpty().withMessage('Tag ID is required')  
            .isString().withMessage('Tag ID must be a string'),  

        body('Date')  
            .notEmpty().withMessage('Date is required') , 
            
      

        body('weight')  
            .notEmpty().withMessage('Weight is required')  
            .isNumeric().withMessage('Weight must be a number')  ,
         
        body('height')  
            .notEmpty().withMessage('Height is required')   
            .isNumeric().withMessage('Height must be a number'),  

        body('weightType')  
            .notEmpty().withMessage('Weight Type is required')  
            .isIn(['birth', 'Weaning', 'regular']).withMessage('Weight Type must be one of: birth, Weaning, regular'),  

        
    ];  
};  

const validateWeight = (req, res, next) => {  
    const errors = validationResult(req);  
    if (!errors.isEmpty()) {  
        return res.status(400).json({ errors: errors.array() });  
    }  
    next();  
};  

module.exports = {  
    weightValidationRules,  
    validateWeight  
};