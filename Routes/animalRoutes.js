const express=require('express');
const router=express.Router();
const animalcontroller=require('../Controllers/animal.controller');
const verifytoken=require('../middleware/verifytoken');
const animalCostController=require('../Controllers/animalcost.controller');
const { animalValidationRules, validateAnimal } =require('../middleware/animal.validation');

router.get('/api/animal/exportAnimalsToExcel',verifytoken,animalcontroller.exportAnimalsToExcel);
router.get('/api/animal/getallanimals',verifytoken,animalcontroller.getallanimals);
router.get('/api/animal/getsinglanimals/:tagId',verifytoken,animalcontroller.getsnigleanimal);
router.post('/api/animal/addanimal',verifytoken, animalValidationRules(), validateAnimal,animalcontroller.addanimal);
router.patch('/api/animal/updateanimal/:tagId',verifytoken, validateAnimal,animalcontroller.updateanimal);
router.delete('/api/animal/deleteanimal/:tagId',verifytoken,animalcontroller.deleteanimal);
router.post('/api/animal/import',verifytoken, animalcontroller.importAnimalsFromExcel);

router.get('/api/animal/getanimalCost',verifytoken,animalCostController.getallanimalscost);



module.exports=router;