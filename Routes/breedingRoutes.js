const express=require('express');
const router=express.Router();
const breedingcontroller=require('../Controllers/breeding.controller');
const verifytoken=require('../middleware/verifytoken');
const { breedingValidationRules, validateBreeding } = require('../middleware/breeding.validation');

router.get('/api/breeding/GetAllBreeding',verifytoken,breedingcontroller.getallBreeding);
router.get('/api/breeding/GetSingleAnimalBreeding/:animalId',verifytoken,breedingcontroller.getbreedingforspacficanimal);
router.get('/api/breeding/GetSingleBreeding/:breedingId',verifytoken,breedingcontroller.getsinglebreeding);
router.post('/api/breeding/AddBreeding',verifytoken ,breedingValidationRules(), validateBreeding,breedingcontroller.addBreeding);
router.patch('/api/breeding/UpdateBreeding/:breedingId',verifytoken,breedingValidationRules(), validateBreeding,breedingcontroller.updatebreeding);
router.delete('/api/breeding/DeleteBreeding/:breedingId',verifytoken,breedingcontroller.deletebreeding);


module.exports=router;