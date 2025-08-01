const express=require('express');
const router=express.Router();
const animalcontroller=require('../Controllers/animal.controller');
const verifytoken=require('../middleware/verifytoken');
const animalCostController=require('../Controllers/animalcost.controller');
const { animalValidationRules, validateAnimal } =require('../middleware/animal.validation');
const setLocale = require('../middleware/localeMiddleware');
const excelOps = require('../utilits/excelOperations');

router.use(setLocale);
router.get('/api/animal/location-sheds',verifytoken,animalcontroller.getAllLocationSheds);
router.get('/api/animal/getAnimalStatistics',verifytoken,animalcontroller.getAnimalStatistics);
router.get('/api/animal/exportAnimalsToExcel',verifytoken,animalcontroller.exportAnimalsToExcel);
router.get('/api/animal/downloadAnimalTemplate',verifytoken, animalcontroller.downloadAnimalTemplate);
router.get('/api/animal/getallanimals',verifytoken,animalcontroller.getallanimals);
router.get('/api/animal/getsinglanimals/:tagId',verifytoken,animalcontroller.getsingleanimal);
router.post('/api/animal/addanimal',verifytoken,animalcontroller.addanimal);
router.patch('/api/animal/updateanimal/:tagId',verifytoken,animalcontroller.updateanimal);
router.delete('/api/animal/deleteanimal/:tagId',verifytoken,animalcontroller.deleteanimal);
router.post('/api/animal/import', verifytoken, excelOps.uploadExcelFile, animalcontroller.importAnimalsFromExcel);

router.get('/api/animal/getanimalCost',verifytoken,animalCostController.getallanimalscost);
router.get('/api/animal/males',verifytoken,animalcontroller.getAllMaleAnimalTagIds);
module.exports=router;