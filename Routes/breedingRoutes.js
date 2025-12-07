const express=require('express');
const router=express.Router();
const breedingcontroller=require('../Controllers/breeding.controller');
const verifytoken=require('../middleware/verifytoken');
const { breedingValidationRules, validateBreeding } = require('../middleware/breeding.validation');
const { requireSubscriptionAndCheckAnimalLimit } = require('../middleware/subscriptionLimit');

router.get('/api/breeding/GetAllBreeding',verifytoken,breedingcontroller.getAllBreeding);
router.get('/api/breeding/GetSingleAnimalBreeding/:animalId',verifytoken,breedingcontroller.getbreedingforspacficanimal);
router.get('/api/breeding/GetSingleBreeding/:breedingId',verifytoken,breedingcontroller.getsinglebreeding);
router.post('/api/breeding/AddBreeding', verifytoken, requireSubscriptionAndCheckAnimalLimit, breedingcontroller.addBreeding);
router.patch('/api/breeding/UpdateBreeding/:breedingId',verifytoken,breedingcontroller.updatebreeding);
router.delete('/api/breeding/DeleteBreeding/:breedingId',verifytoken,breedingcontroller.deletebreeding);

router.post('/api/breeding/import',verifytoken, breedingcontroller.importBreedingFromExcel);

router.get('/api/breeding/downloadBreedingTemplate',verifytoken, breedingcontroller.downloadBreedingTemplate);
router.get('/api/breeding/exportbreedingToExcel',verifytoken,breedingcontroller.exportBreedingToExcel);

module.exports=router;