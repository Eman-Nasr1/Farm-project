const express=require('express');
const router=express.Router();
const feedcontroller=require('../Controllers/feed.controller');
const verifytoken=require('../middleware/verifytoken');

router.get('/api/feed/getallfeeds',verifytoken,feedcontroller.getallfeeds);
router.get('/api/feed/getfeeds',verifytoken,feedcontroller.getfeeds);
router.get('/api/feed/getsinglefeed/:feedId',verifytoken,feedcontroller.getsniglefeed);
router.post('/api/feed/addfeed',verifytoken,feedcontroller.addfeed);
router.patch('/api/feed/updatefeed/:feedId',verifytoken,feedcontroller.updatefeed);
router.delete('/api/feed/deletefeed/:feedId',verifytoken,feedcontroller.deletefeed);

router.post('/api/feed/addfeedbylocationshed',verifytoken, feedcontroller.addFeedToShed);
router.get('/api/feed/getAllFeedByShed',verifytoken,feedcontroller.getAllFeedsByShed);
router.get('/api/feed/getsingleFeedByShed/:feedShedId',verifytoken,feedcontroller.getsniglefeedShed);
router.patch('/api/feed/updatefeedByShed/:shedEntryId',verifytoken,feedcontroller.updateFeedToShed);
router.delete('/api/feed/deletefeedByShed/:feedShedId',verifytoken,feedcontroller.deletefeedshed);

router.post('/api/fodder/addfodder',verifytoken,feedcontroller.manufactureFodder);
router.get('/api/fodder/getallfodder',verifytoken,feedcontroller.getAllFodders);
router.get('/api/fodder/getsinglefodder/:fodderId',verifytoken,feedcontroller.getSingleFodder);
router.patch('/api/fodder/updatefodder/:fodderId',verifytoken,feedcontroller.updateFodder);
router.delete('/api/fodder/deletefodder/:fodderId',verifytoken,feedcontroller.deleteFodder);
module.exports=router;