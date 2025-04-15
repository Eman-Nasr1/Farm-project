const express=require('express');
const router=express.Router();
const treatmentController=require('../Controllers/treatment.controller');
const verifytoken=require('../middleware/verifytoken');

router.get('/api/treatment/getalltreatmentes',verifytoken,treatmentController.getallTreatments);

router.get('/api/treatment/gettreatments',verifytoken,treatmentController.getTreatments);

router.get('/api/treatment/getsingletreatment/:treatmentId',verifytoken,treatmentController.getsnigleTreatment);
router.post('/api/treatment/addtreatment',verifytoken,treatmentController.addTreatment);
router.patch('/api/treatment/updatetreatment/:treatmentId',verifytoken,treatmentController.updateTreatment);
router.delete('/api/treatment/deletetreatment/:treatmentId',verifytoken,treatmentController.deleteTreatment);
router.post('/api/treatment/addtreatmentbylocationshed',verifytoken, treatmentController.addTreatmentForAnimals);
router.post('/api/treatment/addtreatmentbyanimal',verifytoken, treatmentController.addTreatmentForAnimal);
router.get('/api/treatment/gettreatmentsForAnimal/:animalId',verifytoken,treatmentController.getTreatmentsForSpecificAnimal);


router.get('/api/treatment/getAlltreatmentforAnimals',verifytoken,treatmentController.getAllTreatmentsByShed);
router.get('/api/treatment/getsingletreatmentforAnimals/:treatmentShedId',verifytoken,treatmentController.getsingleTreatmentShed);
router.patch('/api/treatment/updatetreatmentforAnimals/:treatmentEntryId',verifytoken,treatmentController.updateTreatmentForAnimal);
router.delete('/api/treatment/deletetreatmentforAnimals/:treatmentShedId',verifytoken,treatmentController.deleteTreatmentShed);



module.exports=router;