const express=require('express');
const router=express.Router();
const animalcontroller=require('../Controllers/animal.controller');
const verifytoken=require('../middleware/verifytoken');

router.get('/api/animal/getallanimals',verifytoken,animalcontroller.getallanimals);
router.get('/api/animal/getsinglanimals/:tagId',verifytoken,animalcontroller.getsnigleanimal);
router.post('/api/animal/addanimal',verifytoken,animalcontroller.addanimal);
router.patch('/api/animal/updateanimal/:tagId',verifytoken,animalcontroller.updateanimal);
router.delete('/api/animal/deleteanimal/:tagId',verifytoken,animalcontroller.deleteanimal);


module.exports=router;