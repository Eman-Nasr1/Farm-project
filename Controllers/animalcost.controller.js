const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const AnimalCost=require('../Models/animalCost.model');



const getallanimalscost = asyncwrapper(async (req, res,next) => {
    
    
    const userId = req.user.id;
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;

    // Create filter object
    const filter = { owner: userId };


    if (query.animalTagId) {
        filter.animalTagId = query.animalTagId; // e.g., 
    }

    // Find animals with applied filters
    const animalCost = await AnimalCost.find(filter, { "__v": false })
        .limit(limit)
        .skip(skip);
    const total = await AnimalCost.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    // Return response
    res.json({
        status: httpstatustext.SUCCESS,
        pagination: {
            page:page,
            limit: limit,
            total: total,
            totalPages:totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
            },
        data: { animalCost }
    });
});


module.exports={
    getallanimalscost,
   
    
}