const express=require('express');
const router=express.Router();
const vaccinecontroller=require('../Controllers/vaccine.controller');
const verifytoken=require('../middleware/verifytoken');
const { vaccineValidationRules, validateVaccine } = require('../middleware/vaccine.validation');

router.get('/api/vaccine/GetAllVaccine',verifytoken,vaccinecontroller.getallVaccine);
router.get('/api/vaccine/GetSingleAnimalGaccine/:animalId',verifytoken,vaccinecontroller.getVaccineforspacficanimal);
router.get('/api/vaccine/GetSingleVaccine/:vaccineId',verifytoken,vaccinecontroller.getVaccineforspacficanimal);
router.post('/api/vaccine/AddVaccine',verifytoken, vaccineValidationRules(), validateVaccine,vaccinecontroller.addvaccine);
router.patch('/api/vaccine/UpdateVaccine/:vaccineId',verifytoken, vaccineValidationRules(), validateVaccine,vaccinecontroller.updateVaccine);
router.delete('/api/vaccine/DeleteVaccine/:vaccineId',verifytoken,vaccinecontroller.deleteVaccine);


module.exports=router;