const express=require('express');
const router=express.Router();
const breedingcontroller=require('../Controllers/breeding.controller');
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const { breedingValidationRules, validateBreeding } = require('../middleware/breeding.validation');
const { requireSubscriptionAndCheckAnimalLimit } = require('../middleware/subscriptionLimit');

// ============================================
// READ OPERATIONS (require breeding.read)
// ============================================

router.get('/api/breeding/GetAllBreeding',
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_READ), 
  breedingcontroller.getAllBreeding
);

router.get('/api/breeding/GetSingleAnimalBreeding/:animalId',
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_READ), 
  breedingcontroller.getbreedingforspacficanimal
);

router.get('/api/breeding/GetSingleBreeding/:breedingId',
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_READ), 
  breedingcontroller.getsinglebreeding
);

// ============================================
// CREATE OPERATIONS (require breeding.create)
// ============================================

router.post('/api/breeding/AddBreeding', 
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_CREATE), 
  requireSubscriptionAndCheckAnimalLimit, 
  breedingcontroller.addBreeding
);

router.post('/api/breeding/import',
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_CREATE), 
  breedingcontroller.importBreedingFromExcel
);

// ============================================
// UPDATE OPERATIONS (require breeding.update)
// ============================================

router.patch('/api/breeding/UpdateBreeding/:breedingId',
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_UPDATE), 
  breedingcontroller.updatebreeding
);

// ============================================
// DELETE OPERATIONS (require breeding.delete)
// ============================================

router.delete('/api/breeding/DeleteBreeding/:breedingId',
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_DELETE), 
  breedingcontroller.deletebreeding
);

// ============================================
// EXPORT OPERATIONS (require breeding.read)
// ============================================

router.get('/api/breeding/downloadBreedingTemplate',
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_READ), 
  breedingcontroller.downloadBreedingTemplate
);

router.get('/api/breeding/exportbreedingToExcel',
  verifytoken, 
  authorize(PERMISSIONS.BREEDING_READ), 
  breedingcontroller.exportBreedingToExcel
);

module.exports=router;