const express = require('express');
const router = express.Router();
const supplierController = require('../Controllers/supplier.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// ============================================
// SUPPLIER OPERATIONS (require settings.manage)
// ============================================

router.get('/api/supplier/getallsuppliers', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  supplierController.getSuppliers
);

router.get('/api/supplier/getSinglesuppliers/:supplierId', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_READ), 
  supplierController.getSingleSupplier
);

router.post('/api/supplier/addsupplier', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  supplierController.addSupplier
);

router.patch('/api/supplier/updatesupplier/:supplierId', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  supplierController.updateSupplier
);

router.delete('/api/supplier/deletesupplier/:supplierId', 
  verifytoken, 
  authorize(PERMISSIONS.SETTINGS_MANAGE), 
  supplierController.deleteSupplier
);





module.exports = router; 