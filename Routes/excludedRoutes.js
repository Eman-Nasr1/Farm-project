const express=require('express');
const router=express.Router();
const excludedcontroller=require('../Controllers/excluded.controller');
const verifytoken=require('../middleware/verifytoken');
const { excludedValidationRules, validateExcluded } = require('../middleware/excluded.validation');

router.get('/api/excluded/getallexcludeds',verifytoken,excludedcontroller.getallexcluded);
router.get('/api/excluded/getSingleExcludeds/:excludedId',verifytoken,excludedcontroller.getSingleExcluded );
router.post('/api/excluded/addexcluded',verifytoken,excludedcontroller.addexcluded);
router.patch('/api/excluded/updateexcluded/:excludedId',verifytoken, excludedValidationRules(),validateExcluded,excludedcontroller.updateExcluded);
router.delete('/api/excluded/deleteexcluded/:excludedId',verifytoken,excludedcontroller.deleteExcluded);


module.exports=router;