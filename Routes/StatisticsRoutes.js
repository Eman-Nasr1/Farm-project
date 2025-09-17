const express=require('express');
const router=express.Router();
const verifyToken = require('../middleware/verifytoken');
const allowedto = require('../middleware/allowedto');
const { getUserStats, getAdminStats } = require('../Controllers/Statistics.controller');


router.get('/api/stats/user', verifyToken, getUserStats);
router.get('/api/stats/admin', verifyToken, allowedto('admin'), getAdminStats);

module.exports = router;
