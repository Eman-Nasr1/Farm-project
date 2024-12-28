const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const AnimalCost=require('../Models/animalCost.model');



const getallanimalscost = asyncwrapper(async (req, res,next) => {
    
    
    const userId = req.userId;
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;

    // Create filter object
    const filter = { owner: userId };


    if (query.tagId) {
        filter.tagId = query.tagId; // e.g., 
    }

    // Find animals with applied filters
    const animalCost = await AnimalCost.find(filter, { "__v": false })
        .limit(limit)
        .skip(skip);

    // Return response
    res.json({
        status: httpstatustext.SUCCESS,
        data: { animalCost }
    });
});


module.exports={
    getallanimalscost,
   
    
}