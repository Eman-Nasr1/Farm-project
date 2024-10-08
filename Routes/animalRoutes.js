const express=require('express');
const router=express.Router();
const animalcontroller=require('../Controllers/animal.controller');
const verifytoken=require('../middleware/verifytoken');
const { animalValidationRules, validateAnimal } =require('../middleware/animal.validation');
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 10000000 }  // Limit to 10MB (adjust as needed)
}).single('file');
router.get('/api/animal/getallanimals',verifytoken,animalcontroller.getallanimals);
router.get('/api/animal/getsinglanimals/:tagId',verifytoken,animalcontroller.getsnigleanimal);
router.post('/api/animal/addanimal',verifytoken, animalValidationRules(), validateAnimal,animalcontroller.addanimal);
router.patch('/api/animal/updateanimal/:tagId',verifytoken, validateAnimal,animalcontroller.updateanimal);
router.delete('/api/animal/deleteanimal/:tagId',verifytoken,animalcontroller.deleteanimal);

router.post('/api/animal/uploadanimaldata', verifytoken, upload, animalcontroller.uploadAnimalData);

module.exports=router;