const Breeding=require('../Models/breeding.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');
const Mating=require('../Models/mating.model');

const getallBreeding =asyncwrapper(async(req,res)=>{

    const userId = req.userId;
    const query=req.query;
    const limit=query.limit||10;
    const page=query.page||1;
    const skip=(page-1)*limit;

    const filter = { owner: userId };

    if (query.tagId) {
        filter.tagId = query.tagId; // e.g., 
    }

    if (query.deliveryDate) {
        filter.deliveryDate = query.deliveryDate; // e.g., 
    }

    const breeding= await Breeding.find(filter,{"__v":false})
    .populate({  
        path: 'animalId', // This is the field in the Mating schema that references Animal  
        select: 'animalType' // Select only the animalType field from the Animal model  
    })  
    .limit(limit).skip(skip);

    if (query.animalType) {  
        const filteredbreedingData = breeding.filter(breeding => breeding.animalId && breeding.animalId.animalType === query.animalType);  
        return res.json({ status: httpstatustext.SUCCESS, data: { breeding: filteredbreedingData } });  
    }  

    res.json({status:httpstatustext.SUCCESS,data:{breeding}});
})

const getbreedingforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    const breeding = await Breeding.find({ animalId: animal._id });

    if (!breeding) {
        const error = AppError.create('breeding information not found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, breeding} });

})

const getsinglebreeding = asyncwrapper(async (req, res, next) => {
    const breedingId = req.params.breedingId;

    // Find the Breeding document by its ID
    const breeding = await Breeding.findById(breedingId);
    if (!breeding) {
        const error = AppError.create('Breeding information not found', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Return the single Breeding record
    return res.json({ status: httpstatustext.SUCCESS, data: { breeding } });
});


// const addBreeding = asyncwrapper(async (req, res,next) => {
//     const userId = req.userId;

//     // Extract tagId from the request body along with the Breeding data
//     const { tagId, ...breedingData } = req.body;

//     // Find the animal with the provided tagId
//     const animal = await Animal.findOne({ tagId });
//     if (!animal) {
//         const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
//         return next(error);
//     }
//     const newBreeding = new Breeding({ ...breedingData, owner: userId, tagId, animalId: animal._id });

//     await newBreeding.save();

//     res.json({ status: httpstatustext.SUCCESS, data: { breeding: newBreeding } });
// })

const addBreeding = asyncwrapper(async (req, res, next) => {  
    const userId = req.userId;  

    // Extract tagId from the request body along with the breeding data  
    const { tagId, birthEntries, ...breedingData } = req.body;  

    // Find the animal with the provided tagId  
    const motherAnimal = await Animal.findOne({ tagId });  
    if (!motherAnimal) {  
        const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);  
        return next(error);  
    }  

    // Fetch the last mating record for the mother animal  
    const lastMating = await Mating.findOne({ animalId: motherAnimal._id }).sort({ createdAt: -1 });  
    const fatherId = lastMating ? lastMating.maleTag_id : null; // Get the father's tagId from the last mating record  

    // Create the new Breeding document with birthEntries included  
    const newBreeding = new Breeding({   
        ...breedingData,   
        owner: userId,   
        tagId,   
        animalId: motherAnimal._id,   
        birthEntries // Include birthEntries here  
    });  
    await newBreeding.save();  

    // Insert each birth entry as a new Animal  
    if (birthEntries && birthEntries.length > 0) {  
        for (const entry of birthEntries) {  
            const newAnimal = new Animal({  
                tagId: entry.tagId,  
                breed: motherAnimal.breed, // Mother's breed  
                animalType: entry.animalType, // Assuming this is provided in each birth entry  
                birthDate: new Date(), // Set birth date to current date or entry birth date  
                gender: entry.gender,  
                owner: userId,  
                motherId: motherAnimal._id,  // Set the motherId  
                fatherId: fatherId, // Set the fatherId from the last mating record  
                locationShed: motherAnimal.locationShed,
            });  

            // Save the new animal document  
            await newAnimal.save();  
        }  
    }  

    res.json({ status: httpstatustext.SUCCESS, data: { breeding: newBreeding } });  
});

const deletebreeding= asyncwrapper(async(req,res,next)=>{
    const userId = req.userId;
    const breedingId = req.params.breedingId;

    // Find the breeding document by its ID
    const breeding = await Breeding.findOne({ _id: breedingId, owner: userId });
    if (!breeding) {
        const error = AppError.create('breeding information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await Breeding.deleteOne({ _id: breedingId });

    res.json({ status: httpstatustext.SUCCESS, message: 'breedinginformation deleted successfully' });

})


// const updatebreeding = asyncwrapper(async (req,res,next)=>{
//     const userId = req.userId;
//     const breedingId = req.params.breedingId;
//     const updatedData = req.body;

//     let breeding = await Breeding.findOne({ _id: breedingId, owner: userId });
//         if (!breeding) {
//             const error = AppError.create('breeding information not found or unauthorized to update', 404, httpstatustext.FAIL);
//             return next(error);
//         }
//         breeding = await Breeding.findOneAndUpdate({ _id: breedingId }, updatedData, { new: true });

//         res.json({ status: httpstatustext.SUCCESS, data: { breeding } });
// })

const updatebreeding = asyncwrapper(async (req, res, next) => {
    const userId = req.userId;
    const breedingId = req.params.breedingId;
    const updatedData = req.body;

    // Find the existing breeding document
    let breeding = await Breeding.findOne({ _id: breedingId, owner: userId });
    if (!breeding) {
        const error = AppError.create('Breeding information not found or unauthorized to update', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Update top-level fields (excluding birthEntries)
    Object.assign(breeding, updatedData);

    // If the deliveryDate is being updated, adjust the weaning dates for birth entries
    if (updatedData.deliveryDate && breeding.birthEntries.length > 0) {
        const newDeliveryDate = new Date(updatedData.deliveryDate);
        const weaningDate = new Date(newDeliveryDate);
        weaningDate.setMonth(weaningDate.getMonth() + 2);

        breeding.birthEntries = breeding.birthEntries.map(entry => {
            entry.expectedWeaningDate = weaningDate;
            return entry;
        });
    }

    // Save the updated breeding document
    await breeding.save();

    res.json({ status: httpstatustext.SUCCESS, data: { breeding } });
});




module.exports={
    updatebreeding,
    deletebreeding,
    addBreeding,
    getbreedingforspacficanimal,
    getsinglebreeding,
    getallBreeding

}