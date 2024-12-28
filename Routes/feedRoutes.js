const express=require('express');
const router=express.Router();
const feedcontroller=require('../Controllers/feed.controller');
const verifytoken=require('../middleware/verifytoken');

router.get('/api/feed/getallfeedes',verifytoken,feedcontroller.getallfeeds);
router.get('/api/feed/getsinglefeed/:feedId',verifytoken,feedcontroller.getsniglefeed);
router.post('/api/feed/addfeed',verifytoken,feedcontroller.addfeed);
router.patch('/api/feed/updatefeed/:feedId',verifytoken,feedcontroller.updatefeed);
router.delete('/api/feed/deletefeed/:feedId',verifytoken,feedcontroller.deletefeed);
router.post('/api/feed/addfeedbylocationshed',verifytoken, feedcontroller.addFeedToShed);


router.get('/api/feed/getAllFeedByShed',verifytoken,feedcontroller.getallfeedsbyshed);
router.get('/api/feed/getsingleFeedByShed/:feedShedId',verifytoken,feedcontroller.getsniglefeedShed);
router.patch('/api/feed/updatefeedByShed/:feedShedId',verifytoken,feedcontroller.updateFeedToShed);
router.delete('/api/feed/deletefeedByShed/:feedShedId',verifytoken,feedcontroller.deletefeedshed);



module.exports=router;