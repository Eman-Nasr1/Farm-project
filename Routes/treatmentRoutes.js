const express=require('express');
const router=express.Router();
const treatmentController=require('../Controllers/treatment.controller');
const verifytoken=require('../middleware/verifytoken');

router.get('/api/treatment/getalltreatmentes',verifytoken,treatmentController.getallTreatments);
router.get('/api/treatment/getsingletreatment/:treatmentId',verifytoken,treatmentController.getsnigleTreatment);
router.post('/api/treatment/addtreatment',verifytoken,treatmentController.addTreatment);
router.patch('/api/treatment/updatetreatment/:treatmentId',verifytoken,treatmentController.updateTreatment);
router.delete('/api/treatment/deletetreatment/:treatmentId',verifytoken,treatmentController.deleteTreatment);
router.post('/api/treatment/addtreatmentbylocationshed',verifytoken, treatmentController.addTreatmentForAnimals);
router.post('/api/treatment/addtreatmentbyanimal',verifytoken, treatmentController.addTreatmentForAnimal);



module.exports=router;