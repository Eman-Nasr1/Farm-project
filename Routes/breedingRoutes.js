const express=require('express');
const router=express.Router();
const breedingcontroller=require('../Controllers/breeding.controller');
const verifytoken=require('../middleware/verifytoken');
const { breedingValidationRules, validateBreeding } = require('../middleware/breeding.validation');

router.get('/api/breeding/getallbreeding',verifytoken,breedingcontroller.getallBreeding);
router.get('/api/breeding/getsinglbreeding/:animalId',verifytoken,breedingcontroller.getbreedingforspacficanimal);
router.post('/api/breeding/addbreeding',verifytoken ,breedingValidationRules(), validateBreeding,breedingcontroller.addBreeding);
router.patch('/api/breeding/updatebreeding/:breedingId',verifytoken,breedingValidationRules(), validateBreeding,breedingcontroller.updatebreeding);
router.delete('/api/breeding/deletebreeding/:breedingId',verifytoken,breedingcontroller.deletebreeding);


module.exports=router;