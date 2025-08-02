const express=require('express');
const router=express.Router();
const weightcontroller=require('../Controllers/weight.controller');
const verifytoken=require('../middleware/verifytoken');
const { weightValidationRules, validateWeight } = require('../middleware/weight.validation');

router.get('/api/weight/GetAllWeight',verifytoken,weightcontroller.getallweight);
router.get('/api/weight/getAllAnimalsWithGrowthData',verifytoken,weightcontroller.getAllAnimalsWithGrowthData);
router.get('/api/weight/getAnimalWithGrowthData/:animalId',verifytoken,weightcontroller.getAnimalWithGrowthData);
router.get('/api/weight/GetSingleAnimalWeight/:animalId',verifytoken,weightcontroller.getWeightforspacficanimal);
router.get('/api/weight/GetSingleWeight/:weightId',verifytoken,weightcontroller.getsingleWeight);
router.post('/api/weight/AddWeight',verifytoken,weightcontroller.addweight);
router.post('/api/weight/importWeightsFromExcel',verifytoken, weightcontroller.importWeightsFromExcel);
router.patch('/api/weight/UpdateWeight/:weightId',verifytoken, weightcontroller.updateweight);
router.delete('/api/weight/DeleteWeight/:weightId',verifytoken,weightcontroller.deleteweight);
router.get('/api/weight/exportWeightsToExcel',verifytoken,weightcontroller.exportWeightsToExcel);
router.get('/api/weight/downloadWeightTemplate',verifytoken, weightcontroller.downloadWeightTemplate);

module.exports=router;