const express=require('express');
const router=express.Router();
const verifyToken = require('../middleware/verifytoken');
const allowedto = require('../middleware/allowedto');
const { getUserStats, getAdminStats,getUserStatsV2,getDailyTasks} = require('../Controllers/Statistics.controller');


router.get('/api/stats/user', verifyToken, getUserStats);
router.get('/api/dashboard/stats-v2', verifyToken, getUserStatsV2);
router.get('/api/dashboard/daily',   verifyToken, getDailyTasks);
router.get('/api/stats/admin', verifyToken, allowedto('admin'), getAdminStats);

module.exports = router;
