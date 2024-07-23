const express=require('express');
const router=express.Router();
const matingcontroller=require('../Controllers/mating.controller');
const verifytoken=require('../middleware/verifytoken');

router.get('/api/mating/getallmating',verifytoken,matingcontroller.getallamating);
router.get('/api/mating/getsinglmating/:animalId',verifytoken,matingcontroller.getmatingforspacficanimal);
router.post('/api/mating/addmating',verifytoken,matingcontroller.addmating);
router.patch('/api/mating/updatemating/:matingId',verifytoken,matingcontroller.updatemating);
router.delete('/api/mating/deletemating/:matingId',verifytoken,matingcontroller.deletemating);


module.exports=router;