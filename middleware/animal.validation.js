// middleware/animalValidation.js  

const { body, validationResult } = require('express-validator');
const { ANIMAL_TYPES } = require('../utilits/animalTypes');

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
            .isIn(ANIMAL_TYPES).withMessage(`Animal type must be one of: ${ANIMAL_TYPES.join(', ')}`),  
        // body('birthDate')  
        //     .optional()  ,
           
        // body('purchaseDate')  
        //     .optional() , 
             
        body('purchasePrice')  
            .optional()  ,
              
        body('gender')  
            .notEmpty().withMessage('Gender is required')  
            .isIn(['male', 'female']).withMessage('Gender must be either male or female'),  
    
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