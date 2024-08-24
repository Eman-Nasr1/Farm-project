const express=require('express');
const router=express.Router();
const vaccinecontroller=require('../Controllers/vaccine.controller');
const verifytoken=require('../middleware/verifytoken');
const { vaccineValidationRules, validateVaccine } = require('../middleware/vaccine.validation');

router.get('/api/vaccine/getallvaccine',verifytoken,vaccinecontroller.getallVaccine);
router.get('/api/vaccine/getsinglvaccine/:animalId',verifytoken,vaccinecontroller.getVaccineforspacficanimal);
router.post('/api/vaccine/addvaccine',verifytoken, vaccineValidationRules(), validateVaccine,vaccinecontroller.addvaccine);
router.patch('/api/vaccine/updatevaccine/:vaccineId',verifytoken, vaccineValidationRules(), validateVaccine,vaccinecontroller.updateVaccine);
router.delete('/api/vaccine/deletevaccine/:vaccineId',verifytoken,vaccinecontroller.deleteVaccine);


module.exports=router;