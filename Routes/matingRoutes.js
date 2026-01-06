const express=require('express');
const router=express.Router();
const matingcontroller=require('../Controllers/mating.controller');
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const { matingValidationRules, validateMating } = require('../middleware/mating.validation');
const excelOps = require('../utilits/excelOperations');

// ============================================
// READ OPERATIONS (require mating.read)
// ============================================

router.get('/api/mating/GetAllMating',
  verifytoken, 
  authorize(PERMISSIONS.MATING_READ), 
  matingcontroller.getAllMating
);

router.get('/api/mating/GetSingleAnimalMating/:animalId',
  verifytoken, 
  authorize(PERMISSIONS.MATING_READ), 
  matingcontroller.getmatingforspacficanimal
);

router.get('/api/mating/GetSingleMating/:matingId',
  verifytoken, 
  authorize(PERMISSIONS.MATING_READ), 
  matingcontroller.getsinglemating
);

// ============================================
// CREATE OPERATIONS (require mating.create)
// ============================================

router.post('/api/mating/AddMating',
  verifytoken, 
  authorize(PERMISSIONS.MATING_CREATE), 
  matingcontroller.addmating
);

router.post('/api/mating/AddMatingByLocation',
  verifytoken, 
  authorize(PERMISSIONS.MATING_CREATE), 
  matingcontroller.addMatingByLocation
);

router.post('/api/mating/import',
  verifytoken, 
  authorize(PERMISSIONS.MATING_CREATE), 
  excelOps.uploadExcelFile, 
  matingcontroller.importMatingFromExcel
);

// ============================================
// UPDATE OPERATIONS (require mating.update)
// ============================================

router.patch('/api/mating/UpdateMating/:matingId',
  verifytoken, 
  authorize(PERMISSIONS.MATING_UPDATE), 
  matingcontroller.updatemating
);

// ============================================
// DELETE OPERATIONS (require mating.delete)
// ============================================

router.delete('/api/mating/DeleteMating/:matingId',
  verifytoken, 
  authorize(PERMISSIONS.MATING_DELETE), 
  matingcontroller.deletemating
);

// ============================================
// EXPORT OPERATIONS (require mating.read)
// ============================================

router.get('/api/mating/export',
  verifytoken, 
  authorize(PERMISSIONS.MATING_READ), 
  matingcontroller.exportMatingToExcel
);

router.get('/api/mating/downloadTemplate',
  verifytoken, 
  authorize(PERMISSIONS.MATING_READ), 
  matingcontroller.downloadMatingTemplate
);

module.exports=router;