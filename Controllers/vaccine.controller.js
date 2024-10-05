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


const getsinglevaccine = asyncwrapper(async (req, res, next) => {
    const vaccineId = req.params.vaccineId;

    // Find the vaccine document by its ID
    const vaccine = await Vaccine.findById(vaccineId);
    if (!vaccine) {
        const error = AppError.create('vaccine information not found', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Return the single vaccine record
    return res.json({ status: httpstatustext.SUCCESS, data: { vaccine } });
});

// const addvaccine = asyncwrapper(async (req, res, next) => {  
//     const userId = req.userId;  
//     const { vaccinationLog, ...vaccineData } = req.body;  
//     const createdVaccines = []; // Array to keep track of created vaccines  
//     // Check if vaccinationLog is empty  
//     if (!vaccinationLog || vaccinationLog.length === 0) {  
//         return next(new AppError('Vaccination log is empty', 400, httpstatustext.FAIL));  
//     }  
//     // Process each log in the vaccinationLog array  
//     for (const log of vaccinationLog) {  
//         const { tagId, ...vaccineData2 } = log; // Destructure tagId and other vaccine data  
//         const animal = await Animal.findOne({ tagId });  
    
//         if (!animal) {  
//             const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);  
//             return next(error);  
//         }  
//         // Create and save the new vaccine  
//         const newVaccine = new Vaccine({ 
//             vaccinationLog,
//             ...vaccineData, // Includes global vaccine data  
//             ...vaccineData2, // Includes vaccine data from the current log  
//             owner: userId,  
//             animalId: animal._id  
//         });  
//         await newVaccine.save();  
//         createdVaccines.push(newVaccine); // Store the created vaccine in the array  
//     }  

//     // Send back the array of created vaccines  
//     res.json({ status: httpstatustext.SUCCESS, data: { vaccines: createdVaccines } });  
// });

const addvaccine = asyncwrapper(async (req, res, next) => {
    const userId = req.userId;  
    const { vaccinationLog, ...vaccineData } = req.body;  
    const createdVaccines = []; // Array to keep track of created vaccines

    // Check if the vaccinationLog is valid and has DateGiven and tagId
    if (!vaccinationLog || vaccinationLog.length === 0 || !vaccinationLog[0].DateGiven || !vaccinationLog[0].tagId) {
        return next(new AppError('Vaccination log must include at least one entry with DateGiven and tagId', 400, httpstatustext.FAIL));
    }

    // If vaccinationLog includes tagId, add vaccine for a single animal
    const tagId = vaccinationLog[0].tagId;
    if (tagId) {
        const animal = await Animal.findOne({ tagId });
        if (!animal) {
            return next(new AppError('Animal not found for the provided tagId', 404, httpstatustext.FAIL));
        }

        // Create the vaccination log for the single animal
        const newVaccine = new Vaccine({
            ...vaccineData,  // Include vaccine name and givenEvery
            vaccinationLog: [{
                tagId: animal.tagId,
                DateGiven: vaccinationLog[0].DateGiven,
                locationShed: animal.locationShed || vaccinationLog[0].locationShed,
                vallidTell: new Date(new Date(vaccinationLog[0].DateGiven).getTime() + (vaccineData.givenEvery * 24 * 60 * 60 * 1000)),
                createdAt: new Date()
            }],
            owner: userId,
            animalId: animal._id
        });

        await newVaccine.save();
        createdVaccines.push(newVaccine);  // Store the created vaccine in the array

        return res.json({ status: httpstatustext.SUCCESS, data: { vaccines: createdVaccines } });
    }

    // If locationShed is provided, fetch all animals in the specified shed
    const locationShed = vaccinationLog[1].locationShed;
    if (locationShed) {
        const animals = await Animal.find({ locationShed });
        if (animals.length === 0) {
            return next(new AppError('No animals found in the specified location shed', 404, httpstatustext.FAIL));
        }

        // Create vaccine for each animal in the shed
        for (const animal of animals) {
            const newVaccine = new Vaccine({
                ...vaccineData,  // Include vaccine name and givenEvery
                vaccinationLog: [{
                    tagId: animal.tagId,
                    DateGiven: vaccinationLog[0].DateGiven,
                    locationShed: animal.locationShed || vaccinationLog[0].locationShed,
                    vallidTell: new Date(new Date(vaccinationLog[0].DateGiven).getTime() + (vaccineData.givenEvery * 24 * 60 * 60 * 1000)),
                    createdAt: new Date()
                }],
                owner: userId,
                animalId: animal._id
            });

            await newVaccine.save();
            createdVaccines.push(newVaccine);  // Store the created vaccine in the array
        }

        return res.json({ status: httpstatustext.SUCCESS, data: { vaccines: createdVaccines } });
    }

    // If neither tagId nor locationShed is provided, return an error
    return next(new AppError('Either tagId or locationShed must be provided', 400, httpstatustext.FAIL));
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
    getsinglevaccine,
    getallVaccine

}