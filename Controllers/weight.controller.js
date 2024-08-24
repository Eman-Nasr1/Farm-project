const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');
const Weight=require('../Models/weight.model');

const getallweight =asyncwrapper(async(req,res)=>{

    const userId = req.userId;
    const query=req.query;
    const limit=query.limit||10;
    const page=query.page||1;
    const skip=(page-1)*limit;

    const weight= await Weight.find({ owner: userId },{"__v":false}).limit(limit).skip(skip);
    res.json({status:httpstatustext.SUCCESS,data:{weight}});
})

const getWeightforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    const weight = await Weight.find({ animalId: animal._id });

    if (!weight) {
        const error = AppError.create('Weight information not found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, weight } });

})

const addweight = asyncwrapper(async (req, res,next) => {
    const userId = req.userId;

    // Extract tagId from the request body along with the mating data
    const { tagId, ...weightData } = req.body;

    // Find the animal with the provided tagId
    const animal = await Animal.findOne({ tagId });
    if (!animal) {
        const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
        return next(error);
    }
    const newWeight = new Weight({ ...weightData, owner: userId, tagId, animalId: animal._id });

    await newWeight.save();

    res.json({ status: httpstatustext.SUCCESS, data: { weight: newWeight } });
})

const deleteweight= asyncwrapper(async(req,res,next)=>{
    const userId = req.userId;
    const weightId = req.params.weightId;

    // Find the Mating document by its ID
    const weight = await Weight.findOne({ _id: weightId, owner: userId });
    if (!weight) {
        const error = AppError.create('Weight information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await Weight.deleteOne({ _id: weightId });

    res.json({ status: httpstatustext.SUCCESS, message: 'Weight information deleted successfully' });

})

const updateweight = asyncwrapper(async (req,res,next)=>{
    const userId = req.userId;
    const weightId = req.params.weightId;
    const updatedData = req.body;

    let weight = await Weight.findOne({ _id: weightId, owner: userId });
        if (!weight) {
            const error = AppError.create('weight information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        weight = await Weight.findOneAndUpdate({ _id: weightId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { weight } });
})


module.exports={
    updateweight,
    deleteweight,
    addweight,
    getWeightforspacficanimal,
    getallweight



}