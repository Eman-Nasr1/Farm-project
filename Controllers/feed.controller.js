const Feed=require('../Models/feed.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const User=require('../Models/user.model');
const ShedEntry = require('../Models/shedFeed.model');
const AnimalCost=require('../Models/animalCost.model');
const Animal=require('../Models/animal.model');

const getallfeeds = asyncwrapper(async (req, res) => {
    const userId = req.userId;
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;
    const filter = { owner: userId };

    if (query.name) {
        filter.name = query.name;
    }

    if (query.type) {
        filter.type = query.type; 
    }

    const feeds = await Feed.find(filter, { "__v": false })
        .limit(limit)
        .skip(skip);

    res.json({
        status: httpstatustext.SUCCESS,
        data: { feeds }
    });
});

const getsniglefeed =asyncwrapper(async( req, res, next)=>{

      const feed=await Feed.findById(req.params.feedId);
      if (!feed) {
        const error=AppError.create('feed not found', 404, httpstatustext.FAIL)
        return next(error);
    }
       return res.json({status:httpstatustext.SUCCESS,data:{feed}});
})

const addfeed = asyncwrapper(async (req, res,next) => {
    
    const userId = req.userId;
 
    const newfeed = new Feed({ ...req.body, owner: userId });
    await newfeed .save();
    res.json({status:httpstatustext.SUCCESS,data:{feed:newfeed }});
})

const updatefeed = asyncwrapper(async (req,res)=>{
    const userId = req.userId;
    const feedId = req.params.feedId;
    const updatedData = req.body;

    let feed = await Feed.findOne({ _id: feedId, owner: userId });
        if (!feed) {
            const error = AppError.create('feed information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        feed = await Feed.findOneAndUpdate({ _id: feedId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { feed } });
})


const deletefeed= asyncwrapper(async(req,res)=>{
    await Feed.deleteOne({_id:req.params.feedId});
   res.status(200).json({status:httpstatustext.SUCCESS,data:null});

})

const addFeedToShed = asyncwrapper(async (req, res, next) => {
    const userId = req.userId;
    const { locationShed, feeds, date } = req.body;

    if (!locationShed || !Array.isArray(feeds) || feeds.length === 0) {
        return res.status(400).json({
            status: "FAILURE",
            message: "locationShed and feeds (array) are required.",
        });
    }

    const animals = await Animal.find({ locationShed });

    if (animals.length === 0) {
        return res.status(404).json({
            status: "FAILURE",
            message: `No animals found in shed "${locationShed}".`,
        });
    }

    const shedEntries = [];
    const feedCosts = [];

    for (const feedItem of feeds) {
        const { feedName, quantity } = feedItem;

        if (!feedName || !quantity) {
            return res.status(400).json({
                status: "FAILURE",
                message: "Each feed must have feedName and quantity.",
            });
        }

        const feed = await Feed.findOne({ name: feedName });

        if (!feed) {
            return res.status(404).json({
                status: "FAILURE",
                message: `Feed with name "${feedName}" not found.`,
            });
        }

        const feedCost = feed.price * quantity;
        feedCosts.push({ feed: feed._id, quantity, cost: feedCost });

        const shedEntry = new ShedEntry({
            feed: feed._id,
            locationShed,
            quantity,
            owner: userId,
            date: date ? new Date(date) : Date.now(),
        });

        await shedEntry.save();
        shedEntries.push(shedEntry);
    }

    // Distribute feed costs across animals
    const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);
    const perAnimalFeedCost = totalFeedCost / animals.length;

    for (const animal of animals) {
        let animalCostEntry = await AnimalCost.findOne({ animalTagId: animal.tagId });

        if (animalCostEntry) {
            animalCostEntry.feedCost += perAnimalFeedCost;
        } else {
            animalCostEntry = new AnimalCost({
                animalTagId: animal.tagId,
                feedCost: perAnimalFeedCost,
                treatmentCost: 0, // Default treatment cost
                date: date,
                owner: userId,
            });
        }

        await animalCostEntry.save();
    }

    res.status(201).json({
        status: "SUCCESS",
        data: {
            shedEntries,
            totalFeedCost,
            perAnimalFeedCost,
        },
    });
});




module.exports={
    getallfeeds,
    getsniglefeed,
    addfeed,
    updatefeed,
    deletefeed,
    addFeedToShed
    
}


