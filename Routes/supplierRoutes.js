const express = require('express');
const router = express.Router();
const supplierController = require('../Controllers/supplier.controller');
const verifytoken = require('../middleware/verifytoken');


router.get('/api/supplier/getallsuppliers', verifytoken, supplierController.getSuppliers);
router.get('/api/supplier/getSinglesuppliers/:supplierId', verifytoken, supplierController.getSingleSupplier);
router.post('/api/supplier/addsupplier', verifytoken, supplierController.addSupplier);
router.patch('/api/supplier/updatesupplier/:supplierId', verifytoken, supplierController.updateSupplier);
router.delete('/api/supplier/deletesupplier/:supplierId', verifytoken, supplierController.deleteSupplier);





module.exports = router; 0