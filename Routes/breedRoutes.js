const express=require('express');
const router=express.Router();
const verifytoken=require('../middleware/verifytoken');
const breedController=require('../Controllers/breed.controller');

router.get('/api/breed/GetAll-breeds',verifytoken,breedController.getAllBreeds);
router.get('/api/breed/GetAll-breeds-menue',verifytoken,breedController.getAllBreedsWithoutPagination);
router.get('/api/breed/GetSingle-breed/:breedId',verifytoken,breedController.getSingleBreed);
router.post('/api/breed/addbreed',verifytoken,breedController.addBreed);
router.patch('/api/breed/updatebreed/:breedId',verifytoken, breedController.updateBreed,);
router.delete('/api/breed/deletebreed/:breedId',verifytoken,breedController.deleteBreed);

module.exports=router;