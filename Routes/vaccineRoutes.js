const express=require('express');
const router=express.Router();
const vaccinecontroller=require('../Controllers/vaccine.controller');
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const { vaccineValidationRules, validateVaccine } = require('../middleware/vaccine.validation');
const excelOps = require('../utilits/excelOperations');

// ============================================
// READ OPERATIONS (require vaccines.read)
// ============================================

router.get('/api/vaccine/GetAllVaccine',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_READ), 
  vaccinecontroller.getAllVaccines
);

router.get('/api/vaccine/GetVaccine-menue',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_READ), 
  vaccinecontroller.getVaccines
);

router.get('/api/vaccine/GetSingleVaccine/:vaccineId',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_READ), 
  vaccinecontroller.getVaccine
);

router.get('/api/vaccine/GetVaccineForAnimal/:animalId',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_READ), 
  vaccinecontroller.getVaccinesForSpecificAnimal
);

router.get('/api/vaccine/getAllVaccineEntries',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_READ), 
  vaccinecontroller.getAllVaccineEntries
);

router.get('/api/vaccine/getSingleVaccineEntry/:vaccineEntryId',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_READ), 
  vaccinecontroller.getSingleVaccineEntry
);

// ============================================
// CREATE OPERATIONS (require vaccines.create)
// ============================================

router.post('/api/vaccine/AddVaccine',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_CREATE), 
  vaccinecontroller.addVaccine
);

router.post('/api/vaccine/AddVaccineForAnimals',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_CREATE), 
  vaccinecontroller.addVaccineForAnimals
);

router.post('/api/vaccine/AddVaccineForAnimal',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_CREATE), 
  vaccinecontroller.addVaccineForAnimal
);

// ============================================
// UPDATE OPERATIONS (require vaccines.update)
// ============================================

router.patch('/api/vaccine/UpdateVaccine/:vaccineId',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_UPDATE), 
  vaccinecontroller.updateVaccine
);

router.patch('/api/vaccine/updateVaccineEntry/:vaccineEntryId',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_UPDATE), 
  vaccinecontroller.updateVaccineEntry
);

// ============================================
// DELETE OPERATIONS (require vaccines.delete)
// ============================================

router.delete('/api/vaccine/DeleteVaccine/:vaccineId',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_DELETE), 
  vaccinecontroller.deleteVaccine
);

router.delete('/api/vaccine/DeleteVaccineEntry/:vaccineEntryId',
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_DELETE), 
  vaccinecontroller.deleteVaccineEntry
);

// ============================================
// EXCEL OPERATIONS
// ============================================

router.post('/api/vaccine/import', 
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_CREATE), 
  excelOps.uploadExcelFile, 
  vaccinecontroller.importVaccineEntriesFromExcel
);

router.get('/api/vaccine/export', 
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_READ), 
  vaccinecontroller.exportVaccineEntriesToExcel
);

router.get('/api/vaccine/downloadTemplate', 
  verifytoken, 
  authorize(PERMISSIONS.VACCINES_READ), 
  vaccinecontroller.downloadVaccineEntryTemplate
);

module.exports=router;