const express=require('express');
const router=express.Router();
const treatmentController=require('../Controllers/treatment.controller');
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const excelOps = require('../utilits/excelOperations');

// ============================================
// READ OPERATIONS (require treatments.read)
// ============================================

router.get('/api/treatment/getalltreatmentes',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_READ), 
  treatmentController.getallTreatments
);

router.get('/api/treatment/gettreatments',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_READ), 
  treatmentController.getTreatments
);

router.get('/api/treatment/getsingletreatment/:treatmentId',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_READ), 
  treatmentController.getsnigleTreatment
);

router.get('/api/treatment/gettreatmentsForAnimal/:animalId',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_READ), 
  treatmentController.getTreatmentsForSpecificAnimal
);

router.get('/api/treatment/getAlltreatmentforAnimals',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_READ), 
  treatmentController.getAllTreatmentsByShed
);

router.get('/api/treatment/getsingletreatmentforAnimals/:treatmentShedId',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_READ), 
  treatmentController.getsingleTreatmentShed
);

// ============================================
// CREATE OPERATIONS (require treatments.create)
// ============================================

router.post('/api/treatment/addtreatment',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_CREATE), 
  treatmentController.addTreatment
);

router.post('/api/treatment/addtreatmentbylocationshed',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_CREATE), 
  treatmentController.addTreatmentForAnimals
);

router.post('/api/treatment/addtreatmentbyanimal',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_CREATE), 
  treatmentController.addTreatmentForAnimal
);

// ============================================
// UPDATE OPERATIONS (require treatments.update)
// ============================================

router.patch('/api/treatment/updatetreatment/:treatmentId',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_UPDATE), 
  treatmentController.updateTreatment
);

router.patch('/api/treatment/updatetreatmentforAnimals/:treatmentEntryId',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_UPDATE), 
  treatmentController.updateTreatmentForAnimal
);

// ============================================
// DELETE OPERATIONS (require treatments.delete)
// ============================================

router.delete('/api/treatment/deletetreatment/:treatmentId',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_DELETE), 
  treatmentController.deleteTreatment
);

router.delete('/api/treatment/deletetreatmentforAnimals/:treatmentShedId',
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_DELETE), 
  treatmentController.deleteTreatmentShed
);

// ============================================
// EXCEL OPERATIONS
// ============================================

router.post('/api/treatment/import', 
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_CREATE), 
  excelOps.uploadExcelFile, 
  treatmentController.importTreatmentsFromExcel
);

router.get('/api/treatment/export', 
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_READ), 
  treatmentController.exportTreatmentsToExcel
);

router.get('/api/treatment/downloadTemplate', 
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_READ), 
  treatmentController.downloadTreatmentTemplate
);

module.exports=router;