const express=require('express');
const router=express.Router();
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const locationShedController=require('../Controllers/locationshed.controller');

// ============================================
// LOCATION/SHED OPERATIONS (require settings.manage)
// ============================================

router.get('/api/location/GetAll-Locationsheds',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  locationShedController.getAllLocationSheds
);

router.get('/api/location/GetAll-Locationsheds-menue',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  locationShedController.getAllLocationShedsWithoutPagination
);

router.get('/api/location/GetSingle-Locationshed/:locationShedId',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  locationShedController.getSingleLocationShed
);

router.get('/api/location/getanimalsinshed',
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  locationShedController.getAnimalsInShed
);

router.post('/api/location/addlocationshed',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  locationShedController.addLocationShed
);

router.patch('/api/location/updatelocationShed/:locationShedId',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  locationShedController.updateLocationShed
);

router.delete('/api/location/deletelocationShed/:locationShedId',
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  locationShedController.deleteLocationShed
);
module.exports=router;