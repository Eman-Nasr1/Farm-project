// middleware/userValidation.js  

const { body, validationResult } = require('express-validator');  

const userValidationRules = () => {  
    return [  
        body('name')  
            .notEmpty().withMessage('Name is required')  
            .isString().withMessage('Name must be a string'),  

        body('email')  
            .notEmpty().withMessage('Email is required')  
            .isEmail().withMessage('Email must be a valid email address')  
            .normalizeEmail(), // Normalize email to lower case  

        body('password')  
            .notEmpty().withMessage('Password is required')  
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),  

        body('confirmpassword')  
            .notEmpty().withMessage('Confirm Password is required')  
            .custom((value, { req }) => {  
                if (value !== req.body.password) {  
                    throw new Error('Confirm Password does not match Password');  
                }  
                return true;  
            }),  

        body('phone')  
            .notEmpty().withMessage('Phone number is required')  
            .isString().withMessage('Phone number must be a string')  
            .isLength({ min: 10 }).withMessage('Phone number must be at least 10 characters long'),  

     
        body('usertype')  
            .optional()  
            .isIn(['farm', 'trader']).withMessage('User type must be either farm or trader'),  

        body('country')  
            .notEmpty().withMessage('Country is required')  
            .isString().withMessage('Country must be a string'),  
    ];  
};  


 

const loginValidationRules = () => {  
    return [  
        body('email')  
            .notEmpty().withMessage('Email is required')  
            .isEmail().withMessage('Email must be a valid email address')  
            .normalizeEmail(), // Normalize email to lower case  

        body('password')  
            .notEmpty().withMessage('Password is required')  
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),  
    ];  
}; 

const validateUser = (req, res, next) => {  
    const errors = validationResult(req);  
    if (!errors.isEmpty()) {  
        return res.status(400).json({ errors: errors.array() });  
    }  
    next();  
};  

module.exports = {  
    userValidationRules,  
    loginValidationRules,
    validateUser  
};