const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Excluded=require('../Models/excluded.model');
const Animal=require('../Models/animal.model');


const getallexcluded =asyncwrapper(async(req,res)=>{

    const userId = req.userId;
    const query=req.query;
    const limit=query.limit||10;
    const page=query.page||1;
    const skip=(page-1)*limit;

    const filter = { owner: userId };

    if (query.tagId) {
        filter.tagId = query.tagId; // e.g., 
    }
    
    if (query.excludedType) {
        filter.excludedType = query.excludedType; // e.g., 
    }


    const excluded = await Excluded.find(filter, { "__v": false })  
    .populate({  
        path: 'animalId', // This is the field in the Mating schema that references Animal  
        select: 'animalType' // Select only the animalType field from the Animal model  
    })  
    .limit(limit)  
    .skip(skip);  

// If animalType is provided in the query, filter the results  
if (query.animalType) {  
    const filteredexcludedData = excluded.filter(excluded => excluded.animalId && excluded.animalId.animalType === query.animalType);  
    return res.json({ status: httpstatustext.SUCCESS, data: { excluded: filteredexcludedData } });  
}  

    res.json({status:httpstatustext.SUCCESS,data:{excluded}});
})

const addexcluded = asyncwrapper(async (req, res,next) => {

    const userId = req.userId;
    const { tagId, ...excludedData } = req.body;
    const animal = await Animal.findOne({ tagId });
    if (!animal) {
        const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
        return next(error);
    }
    const newExcluded = new Excluded({ ...excludedData, owner: userId, tagId, animalId: animal._id });

    await newExcluded.save();

    res.json({ status: httpstatustext.SUCCESS, data: { excluded: newExcluded } });
})

const updateExcluded = asyncwrapper(async (req,res)=>{
    const userId = req.userId;
    const excludedId = req.params.excludedId;
    const updatedData = req.body;

    let excluded = await Excluded.findOne({ _id: excludedId, owner: userId });
        if (!excluded) {
            const error = AppError.create('Excluded information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        excluded = await Excluded.findOneAndUpdate({ _id: excludedId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { excluded } });
})

const deleteExcluded= asyncwrapper(async(req,res,next)=>{
    const userId = req.userId;
    const excludedId = req.params.excludedId;

    const excluded = await Excluded.findOne({ _id: excludedId, owner: userId });
    if (!excluded ) {
        const error = AppError.create('Excluded information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await Excluded.deleteOne({ _id: excludedId });

    res.json({ status: httpstatustext.SUCCESS, message: 'Excluded information deleted successfully' });


})

module.exports={
    deleteExcluded,
    updateExcluded,
    addexcluded ,
    getallexcluded 


}
