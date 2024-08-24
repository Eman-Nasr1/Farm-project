const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Vaccine=require('../Models/vaccine.model');
const Animal=require('../Models/animal.model');


const getallVaccine =asyncwrapper(async(req,res)=>{

    const userId = req.userId;
    const query=req.query;
    const limit=query.limit||10;
    const page=query.page||1;
    const skip=(page-1)*limit;

    const vaccine= await Vaccine.find({ owner: userId },{"__v":false}).limit(limit).skip(skip);
    res.json({status:httpstatustext.SUCCESS,data:{vaccine}});
})


const getVaccineforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    const vaccine = await Vaccine.find({ animalId: animal._id });

    if (!vaccine) {
        const error = AppError.create('Vaccine information not found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, vaccine } });

})


// const addvaccine = asyncwrapper(async (req, res,next) => {
//     const userId = req.userId;

//     const { tagId, ...vaccineData } = req.body;
//     console.log('Request body:', req.body);
//     // Find the animal with the provided tagId
//     const animal = await Animal.findOne({ tagId });
//     if (!animal) {
//         const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
//         return next(error);
//     }
//     const newvaccine = new Vaccine({ ...vaccineData, owner: userId, tagId, animalId: animal._id });

//     await newvaccine.save();

//     res.json({ status: httpstatustext.SUCCESS, data: { vaccine: newvaccine } });
// })

const addvaccine = asyncwrapper(async (req, res, next) => {  
    const userId = req.userId;  
    const { vaccinationLog, ...vaccineData } = req.body;  
    const createdVaccines = []; // Array to keep track of created vaccines  
    // Check if vaccinationLog is empty  
    if (!vaccinationLog || vaccinationLog.length === 0) {  
        return next(new AppError('Vaccination log is empty', 400, httpstatustext.FAIL));  
    }  
    // Process each log in the vaccinationLog array  
    for (const log of vaccinationLog) {  
        const { tagId, ...vaccineData2 } = log; // Destructure tagId and other vaccine data  
        const animal = await Animal.findOne({ tagId });  
    
        if (!animal) {  
            const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);  
            return next(error);  
        }  
        // Create and save the new vaccine  
        const newVaccine = new Vaccine({ 
            vaccinationLog,
            ...vaccineData, // Includes global vaccine data  
            ...vaccineData2, // Includes vaccine data from the current log  
            owner: userId,  
            animalId: animal._id  
        });  
        await newVaccine.save();  
        createdVaccines.push(newVaccine); // Store the created vaccine in the array  
    }  

    // Send back the array of created vaccines  
    res.json({ status: httpstatustext.SUCCESS, data: { vaccines: createdVaccines } });  
});


const updateVaccine = asyncwrapper(async (req,res,next)=>{
    const userId = req.userId;
    const vaccineId = req.params.vaccineId;
    const updatedData = req.body;

    let vaccine = await Vaccine.findOne({ _id: vaccineId, owner: userId });
        if (!vaccine) {
            const error = AppError.create('Vaccine information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        vaccine = await Vaccine.findOneAndUpdate({ _id: vaccineId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { vaccine } });
})

const deleteVaccine= asyncwrapper(async(req,res,next)=>{
    const userId = req.userId;
    const vaccineId = req.params.vaccineId;

    // Find the document by its ID
    const vaccine = await Vaccine.findOne({ _id: vaccineId, owner: userId });
    if (!vaccine) {
        const error = AppError.create('Vaccine information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await vaccine.deleteOne({ _id: vaccineId });

    res.json({ status: httpstatustext.SUCCESS, message: 'Vaccine information deleted successfully' });

})

module.exports={
    deleteVaccine,
    updateVaccine,
    addvaccine,
    getVaccineforspacficanimal,
    getallVaccine

}