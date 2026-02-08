const express=require('express');
const router=express.Router();
const excludedcontroller=require('../Controllers/excluded.controller');
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const { excludedValidationRules, validateExcluded } = require('../middleware/excluded.validation');
const excelOps = require('../utilits/excelOperations');

// ============================================
// READ OPERATIONS (require excluded.read)
// ============================================

router.get('/api/excluded/getallexcludeds',
  verifytoken,
  authorize(PERMISSIONS.EXCLUDED_READ),
  excludedcontroller.getallexcluded
);

router.get('/api/excluded/getSingleExcludeds/:excludedId',
  verifytoken,
  authorize(PERMISSIONS.EXCLUDED_READ),
  excludedcontroller.getSingleExcluded
);

// ============================================
// CREATE OPERATIONS (require excluded.create)
// ============================================

router.post('/api/excluded/addexcluded',
  verifytoken,
  authorize(PERMISSIONS.EXCLUDED_CREATE),
  excludedcontroller.addexcluded
);

// ============================================
// UPDATE OPERATIONS (require excluded.update)
// ============================================

router.patch('/api/excluded/updateexcluded/:excludedId',
  verifytoken,
  authorize(PERMISSIONS.EXCLUDED_UPDATE),
  excludedValidationRules(),
  validateExcluded,
  excludedcontroller.updateExcluded
);

// ============================================
// DELETE OPERATIONS (require excluded.delete)
// ============================================

router.delete('/api/excluded/deleteexcluded/:excludedId',
  verifytoken,
  authorize(PERMISSIONS.EXCLUDED_DELETE),
  excludedcontroller.deleteExcluded
);

// ============================================
// EXCEL OPERATIONS
// ============================================

router.get('/api/excluded/template',
  verifytoken,
  authorize(PERMISSIONS.EXCLUDED_READ),
  excludedcontroller.downloadExcludedTemplate
);

router.post('/api/excluded/import',
  verifytoken,
  authorize(PERMISSIONS.EXCLUDED_CREATE),
  excelOps.uploadExcelFile,
  excludedcontroller.importExcludedFromExcel
);

router.get('/api/excluded/export',
  verifytoken,
  authorize(PERMISSIONS.EXCLUDED_READ),
  excludedcontroller.exportExcludedToExcel
);

module.exports=router;
