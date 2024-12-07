const express=require('express');
const router=express.Router();
const feedcontroller=require('../Controllers/feed.controller');


router.get('/api/feed/getallfeedes',verifytoken,feedcontroller.getallfeeds);
router.get('/api/feed/getsinglefeed/:feedId',verifytoken,feedcontroller.getsniglefeed);
router.post('/api/feed/addfeed',verifytoken,feedcontroller.addfeed);
router.patch('/api/feed/updatefeed/:feedId',verifytoken,feedcontroller.updatefeed);
router.delete('/api/feed/deletefeed/:feedId',verifytoken,feedcontroller.deletefeed);
router.post('/api/feed/addfeedbylocationshed',verifytoken, feedcontroller.addFeedToShed);



module.exports=router;