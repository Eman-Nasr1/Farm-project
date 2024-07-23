const express=require('express');
const router=express.Router();
const usercontroller=require('../Controllers/User.controller');
const verifytoken=require('../middleware/verifytoken');




 
router.get ('/api/getusers',usercontroller.getallusers);

router.post('/api/register',usercontroller.register);

router.post ('/api/login',usercontroller.login);

module.exports=router;