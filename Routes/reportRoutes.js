const express = require('express');
const router = express.Router();
const reportController = require('../Controllers/report.controller');
const report2controller=require('../Controllers/report2.controller');
const verifyToken = require('../middleware/verifytoken');

router.get('/api/report/daily', verifyToken, reportController.generateDailyyyCounts);
router.get('/api/report/daily/download', verifyToken, reportController.generatePDFReport);
router.get('/api/filter/report', verifyToken, report2controller.generateCombinedReport);

module.exports = router;
