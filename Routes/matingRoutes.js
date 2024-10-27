const express=require('express');
const router=express.Router();
const matingcontroller=require('../Controllers/mating.controller');
const verifytoken=require('../middleware/verifytoken');
const { matingValidationRules, validateMating } = require('../middleware/mating.validation')

router.get('/api/mating/GetAllMating',verifytoken,matingcontroller.getallamating);
router.get('/api/mating/GetSingleAnimalMating/:animalId',verifytoken,matingcontroller.getmatingforspacficanimal);
router.get('/api/mating/GetSingleMating/:matingId',verifytoken,matingcontroller.getsinglemating);
router.post('/api/mating/AddMating',verifytoken, matingValidationRules(), validateMating,matingcontroller.addmating);
router.patch('/api/mating/UpdateMating/:matingId',verifytoken, matingValidationRules(),  validateMating,matingcontroller.updatemating);
router.delete('/api/mating/DeleteMating/:matingId',verifytoken,matingcontroller.deletemating);

router.post('/api/mating/import',verifytoken, matingcontroller.importMatingFromExcel);
router.get('/api/mating/exportmatingToExcel',verifytoken,matingcontroller.exportMatingToExcel);

module.exports=router;