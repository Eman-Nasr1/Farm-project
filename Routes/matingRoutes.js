const express=require('express');
const router=express.Router();
const matingcontroller=require('../Controllers/mating.controller');
const verifytoken=require('../middleware/verifytoken');
const { matingValidationRules, validateMating } = require('../middleware/mating.validation')
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/api/mating/GetAllMating',verifytoken,matingcontroller.getAllMating);
router.get('/api/mating/GetSingleAnimalMating/:animalId',verifytoken,matingcontroller.getmatingforspacficanimal);
router.get('/api/mating/GetSingleMating/:matingId',verifytoken,matingcontroller.getsinglemating);
router.post('/api/mating/AddMating',verifytoken,matingcontroller.addmating);
router.post('/api/mating/AddMatingByLocation',verifytoken,matingcontroller.addMatingByLocation);
router.patch('/api/mating/UpdateMating/:matingId',verifytoken,matingcontroller.updatemating);
router.delete('/api/mating/DeleteMating/:matingId',verifytoken,matingcontroller.deletemating);

router.post('/api/mating/import',verifytoken, matingcontroller.importMatingFromExcel);
router.get('/api/mating/export',verifytoken, matingcontroller.exportMatingToExcel);
router.get('/api/mating/downloadTemplate',verifytoken, matingcontroller.downloadMatingTemplate);

module.exports=router;