const express=require('express');
const router=express.Router();
const verifytoken=require('../middleware/verifytoken');
const locationShedController=require('../Controllers/locationshed.controller');

router.get('/api/location/GetAll-Locationsheds',verifytoken,locationShedController.getAllLocationSheds);
router.get('/api/location/GetAll-Locationsheds-menue',verifytoken,locationShedController.getAllLocationShedsWithoutPagination);
router.get('/api/location/GetSingle-Locationshed',verifytoken,locationShedController.getSingleLocationShed);
router.post('/api/location/addlocationshed',verifytoken,locationShedController.addLocationShed);
router.patch('/api/location/updatelocationShed/:locationShedId',verifytoken, locationShedController.updateLocationShed);
router.delete('/api/location/deletelocationShed/:locationShedId',verifytoken,locationShedController.deleteLocationShed);

module.exports=router;