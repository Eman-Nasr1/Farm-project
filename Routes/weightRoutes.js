const express=require('express');
const router=express.Router();
const weightcontroller=require('../Controllers/weight.controller');
const verifytoken=require('../middleware/verifytoken');
const { weightValidationRules, validateWeight } = require('../middleware/weight.validation');

router.get('/api/weight/GetAllWeight',verifytoken,weightcontroller.getallweight);
router.get('/api/weight/GetSingleAnimalWeight/:animalId',verifytoken,weightcontroller.getWeightforspacficanimal);
router.get('/api/weight/GetSingleWeight/:weightId',verifytoken,weightcontroller.getWeightforspacficanimal);
router.post('/api/weight/AddWeight',verifytoken, weightValidationRules(), validateWeight,weightcontroller.addweight);
router.patch('/api/weight/UpdateWeight/:weightId',verifytoken, weightValidationRules(),validateWeight,weightcontroller.updateweight);
router.delete('/api/weight/DeleteWeight/:weightId',verifytoken,weightcontroller.deleteweight);


module.exports=router;