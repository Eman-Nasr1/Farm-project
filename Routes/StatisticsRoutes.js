const express=require('express');
const router=express.Router();
const verifyToken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const allowedto = require('../middleware/allowedto');
const { getUserStats, getAdminStats,getUserStatsV2,getDailyTasks} = require('../Controllers/Statistics.controller');

// ============================================
// STATISTICS OPERATIONS (require statistics.view)
// ============================================

router.get('/api/stats/user', 
  verifyToken, 
  authorize(PERMISSIONS.STATISTICS_VIEW), 
  getUserStats
);

router.get('/api/dashboard/stats-v2', 
  verifyToken, 
  authorize(PERMISSIONS.STATISTICS_VIEW), 
  getUserStatsV2
);

router.get('/api/dashboard/daily', 
  verifyToken, 
  authorize(PERMISSIONS.STATISTICS_VIEW), 
  getDailyTasks
);

router.get('/api/stats/admin', 
  verifyToken, 
  allowedto('admin'), 
  getAdminStats
);

module.exports = router;
