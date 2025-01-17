const express=require('express');
const router=express.Router();
const usercontroller=require('../Controllers/User.controller');
const verifytoken=require('../middleware/verifytoken');
const { userValidationRules, validateUser,loginValidationRules } = require('../middleware/auth.validation');



router.post('/admin/login-as/:userId', verifytoken, usercontroller.loginAsUser);  
router.get ('/api/getusers',verifytoken,usercontroller.getallusers);
router.get ('/api/getSingleUser/:userId',verifytoken,usercontroller.getsnigleuser);
router.patch('/api/updateUser/:userId',verifytoken,usercontroller.updateUser);
router.delete('/api/deleteUser/:userId',verifytoken,usercontroller.deleteUser);

router.post('/api/register', userValidationRules(), validateUser, usercontroller.register);

router.post ('/api/login',loginValidationRules(),validateUser,usercontroller.login);
router.post ('/api/forgetPassword',usercontroller.forgotPassword);
router.post ('/api/resetPassword',usercontroller.resetPassword );
router.post ('/api/verifyCode',usercontroller.verifyCode );


module.exports=router;