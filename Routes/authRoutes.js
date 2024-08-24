const express=require('express');
const router=express.Router();
const usercontroller=require('../Controllers/User.controller');
//const verifytoken=require('../middleware/verifytoken');
const { userValidationRules, validateUser,loginValidationRules } = require('../middleware/auth.validation');



 
router.get ('/api/getusers',usercontroller.getallusers);

router.post('/api/register', userValidationRules(), validateUser, usercontroller.register);

router.post ('/api/login',loginValidationRules(),validateUser,usercontroller.login);
router.post ('/api/forgetPassword',usercontroller.forgotPassword);
router.post ('/api/resetPassword',usercontroller.resetPassword );


module.exports=router;