const Mating=require('../Models/mating.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');

const getallamating =asyncwrapper(async(req,res)=>{

    const userId = req.userId;
    const query=req.query;
    const limit=query.limit||10;
    const page=query.page||1;
    const skip=(page-1)*limit;

    const mating= await Mating.find({ owner: userId },{"__v":false}).limit(limit).skip(skip);
    res.json({status:httpstatustext.SUCCESS,data:{mating}});
})


// in this function getmatingforspacficanimal it will get animal data and mating data 

const getmatingforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    const mating = await Mating.find({ animalId: animal._id });

    if (!mating) {
        const error = AppError.create('Mating information not found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, mating } });

})


const addmating = asyncwrapper(async (req, res,next) => {
    const userId = req.userId;

    // Extract tagId from the request body along with the mating data
    const { tagId, ...matingData } = req.body;

    // Find the animal with the provided tagId
    const animal = await Animal.findOne({ tagId });
    if (!animal) {
        const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
        return next(error);
    }
    const newMating = new Mating({ ...matingData, owner: userId, tagId, animalId: animal._id });

    await newMating.save();

    res.json({ status: httpstatustext.SUCCESS, data: { mating: newMating } });
})



const deletemating= asyncwrapper(async(req,res,next)=>{
    const userId = req.userId;
    const matingId = req.params.matingId;

    // Find the Mating document by its ID
    const mating = await Mating.findOne({ _id: matingId, owner: userId });
    if (!mating) {
        const error = AppError.create('Mating information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await Mating.deleteOne({ _id: matingId });

    res.json({ status: httpstatustext.SUCCESS, message: 'Mating information deleted successfully' });

})

const updatemating = asyncwrapper(async (req,res,next)=>{
    const userId = req.userId;
    const matingId = req.params.matingId;
    const updatedData = req.body;

    let mating = await Mating.findOne({ _id: matingId, owner: userId });
        if (!mating) {
            const error = AppError.create('Mating information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        mating = await Mating.findOneAndUpdate({ _id: matingId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { mating } });
})

module.exports={
    getallamating,
    updatemating,
    deletemating,
    addmating,
    getmatingforspacficanimal

}
