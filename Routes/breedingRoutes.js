const express=require('express');
const router=express.Router();
const breedingcontroller=require('../Controllers/breeding.controller');
const verifytoken=require('../middleware/verifytoken');

router.get('/api/breeding/getallbreeding',verifytoken,breedingcontroller.getallBreeding);
router.get('/api/breeding/getsinglbreeding/:animalId',verifytoken,breedingcontroller.getbreedingforspacficanimal);
router.post('/api/breeding/addbreeding',verifytoken,breedingcontroller.addBreeding);
router.patch('/api/breeding/updatebreeding/:breedingId',verifytoken,breedingcontroller.updatebreeding);
router.delete('/api/breeding/deletebreeding/:breedingId',verifytoken,breedingcontroller.deletebreeding);


module.exports=router;