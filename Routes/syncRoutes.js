const express = require('express');
const router = express.Router();
const verifytoken = require('../middleware/verifytoken');
const syncController = require('../Controllers/sync.controller');

router.get('/api/sync/changes', verifytoken, syncController.getChanges);
router.post('/api/sync/batch', verifytoken, syncController.syncBatch);

module.exports = router;
