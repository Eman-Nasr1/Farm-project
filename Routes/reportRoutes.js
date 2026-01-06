const express = require('express');
const router = express.Router();
const reportController = require('../Controllers/report.controller');
const report2controller=require('../Controllers/report2.controller');
const verifyToken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// ============================================
// REPORT OPERATIONS (require reports.view)
// ============================================

router.get('/api/report/daily', 
  verifyToken, 
  authorize(PERMISSIONS.REPORTS_VIEW), 
  reportController.generateDailyyyCounts
);

router.get('/api/report/daily/download', 
  verifyToken, 
  authorize(PERMISSIONS.REPORTS_VIEW), 
  reportController.generatePDFReport
);

router.get('/api/filter/report', 
  verifyToken, 
  authorize(PERMISSIONS.REPORTS_VIEW), 
  report2controller.generateCombinedReport
);

router.get('/api/report/download', 
  verifyToken, 
  authorize(PERMISSIONS.REPORTS_VIEW), 
  report2controller.generateCombinedPDFReport
);
module.exports = router;
