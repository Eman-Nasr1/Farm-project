const express=require('express');
const router=express.Router();
const vaccinecontroller=require('../Controllers/vaccine.controller');
const verifytoken=require('../middleware/verifytoken');
const { vaccineValidationRules, validateVaccine } = require('../middleware/vaccine.validation');

router.get('/api/vaccine/GetAllVaccine',verifytoken,vaccinecontroller.getAllVaccines);
router.get('/api/vaccine/GetVaccine-menue',verifytoken,vaccinecontroller.getVaccines);
router.get('/api/vaccine/GetSingleVaccine/:vaccineId',verifytoken,vaccinecontroller.getVaccine);
router.post('/api/vaccine/AddVaccine',verifytoken,vaccinecontroller.addVaccine);

router.get('/api/vaccine/GetVaccineForAnimal/:animalId',verifytoken,vaccinecontroller.getVaccinesForSpecificAnimal);

router.patch('/api/vaccine/UpdateVaccine/:vaccineId',verifytoken, vaccinecontroller.updateVaccine);
router.delete('/api/vaccine/DeleteVaccine/:vaccineId',verifytoken,vaccinecontroller.deleteVaccine);


router.post('/api/vaccine/AddVaccineForAnimals',verifytoken,vaccinecontroller.addVaccineForAnimals);
router.post('/api/vaccine/AddVaccineForAnimal',verifytoken,vaccinecontroller.addVaccineForAnimal);
router.get('/api/vaccine/getAllVaccineEntries',verifytoken,vaccinecontroller.getAllVaccineEntries);
router.get('/api/vaccine/getSingleVaccineEntry/:vaccineEntryId',verifytoken,vaccinecontroller.getSingleVaccineEntry);
router.patch('/api/vaccine/updateVaccineEntry/:vaccineEntryId',verifytoken, vaccinecontroller.updateVaccineEntry);
router.delete('/api/vaccine/DeleteVaccineEntry/:vaccineEntryId',verifytoken,vaccinecontroller.deleteVaccineEntry);

// Excel operations
router.post('/api/vaccine/import', verifytoken, vaccinecontroller.importVaccineEntriesFromExcel);
router.get('/api/vaccine/export', verifytoken, vaccinecontroller.exportVaccineEntriesToExcel);
router.get('/api/vaccine/downloadTemplate', verifytoken, vaccinecontroller.downloadVaccineEntryTemplate);

module.exports=router;