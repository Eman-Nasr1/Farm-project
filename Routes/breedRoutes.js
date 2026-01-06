const express=require('express');
const router=express.Router();
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const breedController=require('../Controllers/breed.controller');

// ============================================
// BREED OPERATIONS (require settings.manage)
// ============================================

router.get('/api/breed/GetAll-breeds',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  breedController.getAllBreeds
);

router.get('/api/breed/GetAll-breeds-menue',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  breedController.getAllBreedsWithoutPagination
);

router.get('/api/breed/GetSingle-breed/:breedId',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  breedController.getSingleBreed
);

router.post('/api/breed/addbreed',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  breedController.addBreed
);

router.patch('/api/breed/updatebreed/:breedId',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  breedController.updateBreed
);

router.delete('/api/breed/deletebreed/:breedId',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  breedController.deleteBreed
);

module.exports=router;