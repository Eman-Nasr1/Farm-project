const express=require('express');
const router=express.Router();
const weightcontroller=require('../Controllers/weight.controller');
const verifytoken=require('../middleware/verifytoken');
const { weightValidationRules, validateWeight } = require('../middleware/weight.validation');

router.get('/api/weight/getallweight',verifytoken,weightcontroller.getallweight);
router.get('/api/weight/getsinglweight/:animalId',verifytoken,weightcontroller.getWeightforspacficanimal);
router.post('/api/weight/addweight',verifytoken, weightValidationRules(), validateWeight,weightcontroller.addweight);
router.patch('/api/weight/updateweight/:weightId',verifytoken, weightValidationRules(), validateWeight,weightcontroller.updateweight);
router.delete('/api/weight/deleteweight/:weightId',verifytoken,weightcontroller.deleteweight);


module.exports=router;