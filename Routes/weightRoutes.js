const express=require('express');
const router=express.Router();
const weightcontroller=require('../Controllers/weight.controller');
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const { weightValidationRules, validateWeight } = require('../middleware/weight.validation');

// ============================================
// READ OPERATIONS (require weight.read)
// ============================================

router.get('/api/weight/GetAllWeight',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_READ), 
  weightcontroller.getallweight
);

router.get('/api/weight/getAllAnimalsWithGrowthData',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_READ), 
  weightcontroller.getAllAnimalsWithGrowthData
);

router.get('/api/weight/getAnimalWithGrowthData/:animalId',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_READ), 
  weightcontroller.getAnimalWithGrowthData
);

router.get('/api/weight/GetSingleAnimalWeight/:animalId',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_READ), 
  weightcontroller.getWeightforspacficanimal
);

router.get('/api/weight/GetSingleWeight/:weightId',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_READ), 
  weightcontroller.getsingleWeight
);

// ============================================
// CREATE OPERATIONS (require weight.create)
// ============================================

router.post('/api/weight/AddWeight',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_CREATE), 
  weightcontroller.addweight
);

router.post('/api/weight/importWeightsFromExcel',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_CREATE), 
  weightcontroller.importWeightsFromExcel
);

// ============================================
// UPDATE OPERATIONS (require weight.update)
// ============================================

router.patch('/api/weight/UpdateWeight/:weightId',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_UPDATE), 
  weightcontroller.updateweight
);

// ============================================
// DELETE OPERATIONS (require weight.delete)
// ============================================

router.delete('/api/weight/DeleteWeight/:weightId',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_DELETE), 
  weightcontroller.deleteweight
);

// ============================================
// EXPORT OPERATIONS (require weight.read)
// ============================================

router.get('/api/weight/exportWeightsToExcel',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_READ), 
  weightcontroller.exportWeightsToExcel
);

router.get('/api/weight/downloadWeightTemplate',
  verifytoken, 
  authorize(PERMISSIONS.WEIGHT_READ), 
  weightcontroller.downloadWeightTemplate
);

module.exports=router;