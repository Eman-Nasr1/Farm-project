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
            .optional()  ,
           
        body('purchaseData')  
            .optional() , 
             
        body('purchasePrice')  
            .optional()  ,
              
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