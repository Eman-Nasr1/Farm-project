const express=require('express');
const router=express.Router();
const employeeController=require('../Controllers/employee.controller');
//const verifytoken=require('../middleware/verifytoken');


router.post('/api/createEmployee',  employeeController.createEmployee);

router.post ('/api/employeeLogin',employeeController.employeeLogin);


module.exports=router;