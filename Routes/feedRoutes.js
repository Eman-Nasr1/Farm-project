const express=require('express');
const router=express.Router();
const feedcontroller=require('../Controllers/feed.controller');
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// ============================================
// READ OPERATIONS (require feed.read)
// ============================================

router.get('/api/feed/getallfeeds',
  verifytoken, 
  authorize(PERMISSIONS.FEED_READ), 
  feedcontroller.getallfeeds
);

router.get('/api/feed/getfeeds',
  verifytoken, 
  authorize(PERMISSIONS.FEED_READ), 
  feedcontroller.getfeeds
);

router.get('/api/feed/getsinglefeed/:feedId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_READ), 
  feedcontroller.getsniglefeed
);

router.get('/api/feed/getAllFeedByShed',
  verifytoken, 
  authorize(PERMISSIONS.FEED_READ), 
  feedcontroller.getAllFeedsByShed
);

router.get('/api/feed/getsingleFeedByShed/:feedShedId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_READ), 
  feedcontroller.getsniglefeedShed
);

router.get('/api/fodder/getallfodder',
  verifytoken, 
  authorize(PERMISSIONS.FEED_READ), 
  feedcontroller.getAllFodders
);

router.get('/api/fodder/getsinglefodder/:fodderId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_READ), 
  feedcontroller.getSingleFodder
);

// ============================================
// CREATE OPERATIONS (require feed.create)
// ============================================

router.post('/api/feed/addfeed',
  verifytoken, 
  authorize(PERMISSIONS.FEED_CREATE), 
  feedcontroller.addfeed
);

router.post('/api/feed/addfeedbylocationshed',
  verifytoken, 
  authorize(PERMISSIONS.FEED_CREATE), 
  feedcontroller.addFeedToShed
);

router.post('/api/fodder/addfodder',
  verifytoken, 
  authorize(PERMISSIONS.FEED_CREATE), 
  feedcontroller.manufactureFodder
);

// ============================================
// UPDATE OPERATIONS (require feed.update)
// ============================================

router.patch('/api/feed/updatefeed/:feedId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_UPDATE), 
  feedcontroller.updatefeed
);

router.patch('/api/feed/updatefeedByShed/:shedEntryId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_UPDATE), 
  feedcontroller.updateFeedToShed
);

router.patch('/api/fodder/updatefodder/:fodderId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_UPDATE), 
  feedcontroller.updateFodder
);

// ============================================
// DELETE OPERATIONS (require feed.delete)
// ============================================

router.delete('/api/feed/deletefeed/:feedId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_DELETE), 
  feedcontroller.deletefeed
);

router.delete('/api/feed/deletefeedByShed/:feedShedId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_DELETE), 
  feedcontroller.deletefeedshed
);

router.delete('/api/fodder/deletefodder/:fodderId',
  verifytoken, 
  authorize(PERMISSIONS.FEED_DELETE), 
  feedcontroller.deleteFodder
);
module.exports=router;