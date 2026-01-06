const express=require('express');
const router=express.Router();
const animalcontroller=require('../Controllers/animal.controller');
const verifytoken=require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const optionalAuth = require('../middleware/optionalAuth');
const animalCostController=require('../Controllers/animalcost.controller');
const { animalValidationRules, validateAnimal } =require('../middleware/animal.validation');
const setLocale = require('../middleware/localeMiddleware');
const excelOps = require('../utilits/excelOperations');
const { requireSubscriptionAndCheckAnimalLimit } = require('../middleware/subscriptionLimit');

router.use(setLocale);

// ============================================
// READ OPERATIONS (require animals.read)
// ============================================

router.get('/api/animal/location-sheds', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getAllLocationSheds
);

router.get('/api/animal/getAnimalStatistics', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getAnimalStatistics
);

router.get('/api/animal/getallanimals', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getallanimals
);

router.get('/api/animal/getsinglanimals/:tagId', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getsingleanimal
);

router.get('/api/animal/males', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getAllMaleAnimalTagIds
);

router.get('/api/animal/getanimalCost', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalCostController.getallanimalscost
);

// ============================================
// EXPORT OPERATIONS (require animals.read)
// ============================================

router.get('/api/animal/exportAnimalsToExcel', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.exportAnimalsToExcel
);

router.get('/api/animal/downloadAnimalTemplate', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.downloadAnimalTemplate
);

// ============================================
// CREATE OPERATIONS (require animals.create)
// ============================================

router.post('/api/animal/addanimal', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_CREATE), 
  requireSubscriptionAndCheckAnimalLimit, 
  animalcontroller.addanimal
);

router.post('/api/animal/import', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_CREATE), 
  excelOps.uploadExcelFile, 
  animalcontroller.importAnimalsFromExcel
);

// ============================================
// UPDATE OPERATIONS (require animals.update)
// ============================================

router.patch('/api/animal/updateanimal/:tagId', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_UPDATE), 
  animalcontroller.updateanimal
);

router.post('/api/animal/moveanimals', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_UPDATE), 
  animalcontroller.moveAnimals
);

// ============================================
// DELETE OPERATIONS (require animals.delete)
// ============================================

router.delete('/api/animal/deleteanimal/:tagId', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_DELETE), 
  animalcontroller.deleteanimal
);

// ============================================
// PUBLIC ROUTES (no permission required)
// ============================================

// Public scan route (optional auth - works with or without login)
router.get('/api/scan/:token', optionalAuth, animalcontroller.getAnimalByQrToken);

module.exports=router;