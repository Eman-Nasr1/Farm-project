const Feed = require("../Models/feed.model");
const Fodder=require("../Models/fodder.model");
const httpstatustext = require("../utilits/httpstatustext");
const asyncwrapper = require("../middleware/asyncwrapper");
const AppError = require("../utilits/AppError");
const User = require("../Models/user.model");
const ShedEntry = require("../Models/shedFeed.model");
const AnimalCost = require("../Models/animalCost.model");
const Animal = require("../Models/animal.model");
const { ConsoleMessage } = require("puppeteer");

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

  const feeds = await Feed.find(filter, { __v: false }).limit(limit).skip(skip);
  const total = await Feed.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);
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
    data: { feeds },
  });
});

const getfeeds=asyncwrapper(async (req, res)=>{
  const userId = req.userId;
  const query = req.query;
  const filter = { owner: userId };
  const feeds = await Feed.find(filter, { "__v": false }).sort({ createdAt: -1 });
  res.json({
      status: 'success',
      data: feeds
  });
});
const getsniglefeed = asyncwrapper(async (req, res, next) => {
  const feed = await Feed.findById(req.params.feedId);
  if (!feed) {
    const error = AppError.create("feed not found", 404, httpstatustext.FAIL);
    return next(error);
  }
  return res.json({ status: httpstatustext.SUCCESS, data: { feed } });
});

const addfeed = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;

  const newfeed = new Feed({ ...req.body, owner: userId });
  await newfeed.save();
  res.json({ status: httpstatustext.SUCCESS, data: { feed: newfeed } });
});

const updatefeed = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const feedId = req.params.feedId;
  const updatedData = req.body;

  let feed = await Feed.findOne({ _id: feedId, owner: userId });
  if (!feed) {
    const error = AppError.create(
      "feed information not found or unauthorized to update",
      404,
      httpstatustext.FAIL
    );
    return next(error);
  }
  feed = await Feed.findOneAndUpdate({ _id: feedId }, updatedData, {
    new: true,
  });

  res.json({ status: httpstatustext.SUCCESS, data: { feed } });
});

const deletefeed = asyncwrapper(async (req, res,next) => {
  await Feed.deleteOne({ _id: req.params.feedId });
  res.status(200).json({ status: httpstatustext.SUCCESS, data: null });
});

// --------------------------------------feed by shed ------------------------

// const addFeedToShed = asyncwrapper(async (req, res, next) => {
//   const userId = req.userId;
//   const { locationShed, feeds, date } = req.body;

//   if (!locationShed || !Array.isArray(feeds) || feeds.length === 0) {
//     return res.status(400).json({
//       status: "FAILURE",
//       message: "locationShed and feeds (array) are required.",
//     });
//   }

//   const animals = await Animal.find({ locationShed });

//   if (animals.length === 0) {
//     return res.status(404).json({
//       status: "FAILURE",
//       message: `No animals found in shed "${locationShed}".`,
//     });
//   }

//   const shedEntries = [];
//   const feedCosts = [];

//   for (const feedItem of feeds) {
//     const { feedName, quantity } = feedItem;

//     if (!feedName || !quantity) {
//       return res.status(400).json({
//         status: "FAILURE",
//         message: "Each feed must have feedName and quantity.",
//       });
//     }

//     const feed = await Feed.findOne({ name: feedName });

//     if (!feed) {
//       return res.status(404).json({
//         status: "FAILURE",
//         message: `Feed with name "${feedName}" not found.`,
//       });
//     }

//     const feedCost = feed.price * quantity;
//     feedCosts.push({ feed: feed._id, quantity, cost: feedCost });

//     const shedEntry = new ShedEntry({
//       feed: feed._id,
//       locationShed,
//       quantity,
//       owner: userId,
//       date: date ? new Date(date) : Date.now(),
//     });

//     await shedEntry.save();
//     shedEntries.push(shedEntry);
//   }

//   // Distribute feed costs across animals
//   const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);
//   const perAnimalFeedCost = totalFeedCost / animals.length;

//   for (const animal of animals) {
//     let animalCostEntry = await AnimalCost.findOne({
//       animalTagId: animal.tagId,
//     });

//     if (animalCostEntry) {
//       animalCostEntry.feedCost += perAnimalFeedCost;
//     } else {
//       animalCostEntry = new AnimalCost({
//         animalTagId: animal.tagId,
//         feedCost: perAnimalFeedCost,
//         treatmentCost: 0, // Default treatment cost
//         date: date,
//         owner: userId,
//       });
//     }

//     await animalCostEntry.save();
//   }

//   res.status(201).json({
//     status: "SUCCESS",
//     data: {
//       shedEntries,
//       totalFeedCost,
//       perAnimalFeedCost,
//     },
//   });
// });

const addFeedToSheddd = asyncwrapper(async (req, res, next) => {  
  const userId = req.userId;  
  const { locationShed, feeds, date } = req.body;  

  if (!locationShed || !Array.isArray(feeds) || feeds.length === 0) {  
    return res.status(400).json({  
      status: "FAILURE",  
      message: "locationShed and feeds (array) are required.",  
    });  
  }  

  // Fetch animals at the shed  
  const animals = await Animal.find({ locationShed });  
  if (animals.length === 0) {  
    return res.status(404).json({  
      status: "FAILURE",  
      message: `No animals found in shed "${locationShed}".`,  
    });  
  }  

  const feedCosts = [];  
  const allFeeds = [];  

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

if (feed.quantity < quantity) {
  return res.status(400).json({
    status: "FAILURE",
    message: `Not enough stock for feed "${feed.name}". Available: ${feed.quantity}, Requested: ${quantity}.`,
  });
}

// Subtract the quantity used from stock
feed.quantity -= quantity;
await feed.save();

    const feedCost = feed.price * quantity;  
    feedCosts.push({ feed: feed._id, quantity, cost: feedCost });  

    // Include feedId in the allFeeds array  
    allFeeds.push({  
      feedId: feed._id, // Add feedId  
      feedName: feedName,  
      quantity: quantity,  
    });  
  }  

  // Total feed cost calculations  
  const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);  
  const perAnimalFeedCost = totalFeedCost / animals.length;  

  // Create a single shed entry with the modified feeds array  
  const shedEntry = new ShedEntry({  
    locationShed,  
    owner: userId,  
    feeds: allFeeds, // Use the new array with feedId  
    date: date ? new Date(date) : Date.now(),  
  });  

  await shedEntry.save();  

  // Cost entry updates for each animal  
  for (const animal of animals) {  
    let animalCostEntry = await AnimalCost.findOne({  
      animalTagId: animal.tagId,  
    });  

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
      shedEntry: {  
        _id: shedEntry._id,  
        locationShed: shedEntry.locationShed,  
        owner: shedEntry.owner,  
        feeds: shedEntry.feeds,  
        createdAt: shedEntry.createdAt,  
        __v: shedEntry.__v,  
      },  
      totalFeedCost,  
      perAnimalFeedCost,  
    },  
  });  
});

const addFeedToShed33 = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const { locationShed, feeds, date } = req.body;

  if (!locationShed || !Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({
      status: "FAILURE",
      message: "locationShed and feeds (array) are required.",
    });
  }

  // Log feeds to see the incoming data structure
  console.log("Incoming feeds:", feeds);

  // Fetch animals at the shed
  const animals = await Animal.find({ locationShed });
  if (animals.length === 0) {
    return res.status(404).json({
      status: "FAILURE",
      message: `No animals found in shed "${locationShed}".`,
    });
  }

  const feedCosts = [];
  const allFeeds = [];

  for (const feedItem of feeds) {
    const { feedName, quantity } = feedItem;

    // Log the quantity to see if it's NaN
    console.log("Processing feed:", feedName, "with quantity:", quantity);

    if (!feedName || !quantity) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each feed must have feedName and quantity.",
      });
    }

    // Validate quantity to ensure it's a valid number
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Invalid quantity: "${quantity}". It must be a positive number.`,
      });
    }

    const feed = await Feed.findOne({ name: feedName });
    if (!feed) {
      return res.status(404).json({
        status: "FAILURE",
        message: `Feed with name "${feedName}" not found.`,
      });
    }

    if (feed.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        status: "FAILURE",
        message: "You are not authorized to use this feed.",
      });
    }

    // Ensure there is enough quantity in stock
    if (feed.quantity < quantity) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Not enough stock for feed "${feed.name}". Available: ${feed.quantity}, Requested: ${quantity}.`,
      });
    }
    console.log("Updating feed quantity:", feed.quantity);
    // Subtract the quantity used from stock
    feed.quantity -= quantity;
    console.log("New feed quantity:", feed.quantity);
    await feed.save();

    // Calculate feed cost and push it to the array
    const feedCost = feed.price * quantity;
    feedCosts.push({ feed: feed._id, quantity, cost: feedCost });

    // Include feedId in the allFeeds array
    allFeeds.push({
      feedId: feed._id,
      feedName: feed.name,
      quantity: quantity,
    });
  }

  // Total feed cost calculations
  const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);
  const perAnimalFeedCost = totalFeedCost / animals.length;

  // Create a single shed entry with the modified feeds array
  const shedEntry = new ShedEntry({
    locationShed,
    owner: userId,
    feeds: allFeeds, // Use the new array with feedId
    date: date ? new Date(date) : Date.now(),
  });

  await shedEntry.save();

  // Cost entry updates for each animal
  for (const animal of animals) {
    let animalCostEntry = await AnimalCost.findOne({
      animalTagId: animal.tagId,
    });

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
      shedEntry: {
        _id: shedEntry._id,
        locationShed: shedEntry.locationShed,
        owner: shedEntry.owner,
        feeds: shedEntry.feeds,
        createdAt: shedEntry.createdAt,
        __v: shedEntry.__v,
      },
      totalFeedCost,
      perAnimalFeedCost,
    },
  });
});
const addFeedToShed = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const { locationShed, feeds, date } = req.body;

  if (!locationShed || !Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({
      status: "FAILURE",
      message: "locationShed and feeds (array) are required.",
    });
  }

  // Log feeds to see the incoming data structure
  console.log("Incoming feeds:", feeds);

  // Fetch animals at the shed
  const animals = await Animal.find({ locationShed });
  if (animals.length === 0) {
    return res.status(404).json({
      status: "FAILURE",
      message: `No animals found in shed "${locationShed}".`,
    });
  }

  const feedCosts = [];
  const allFeeds = [];

  for (const feedItem of feeds) {
    const { feedId, quantity } = feedItem;

    // Log the quantity to see if it's NaN
    console.log("Processing feed:", feedId, "with quantity:", quantity);

    if (!feedId || !quantity) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each feed must have feedId and quantity.",
      });
    }

    // Validate quantity to ensure it's a valid number
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Invalid quantity: "${quantity}". It must be a positive number.`,
      });
    }

    const feed = await Feed.findById(feedId);
    if (!feed) {
      return res.status(404).json({
        status: "FAILURE",
        message: `Feed with ID "${feedId}" not found.`,
      });
    }

    if (feed.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        status: "FAILURE",
        message: "You are not authorized to use this feed.",
      });
    }

    // Ensure there is enough quantity in stock
    if (feed.quantity < quantity) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Not enough stock for feed "${feed.name}". Available: ${feed.quantity}, Requested: ${quantity}.`,
      });
    }
    console.log("Updating feed quantity:", feed.quantity);
    // Subtract the quantity used from stock
    feed.quantity -= quantity;
    console.log("New feed quantity:", feed.quantity);
    await feed.save();

    // Calculate feed cost and push it to the array
    const feedCost = feed.price * quantity;
    feedCosts.push({ feed: feed._id, quantity, cost: feedCost });

    // Include feedId in the allFeeds array
    allFeeds.push({
      feedId: feed._id,
      feedName: feed.name,
      quantity: quantity,
    });
  }

  // Total feed cost calculations
  const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);
  const perAnimalFeedCost = totalFeedCost / animals.length;

  // Create a single shed entry with the modified feeds array
  const shedEntry = new ShedEntry({
    locationShed,
    owner: userId,
    feeds: allFeeds, // Use the new array with feedId
    date: date ? new Date(date) : Date.now(),
  });

  await shedEntry.save();

  // Cost entry updates for each animal
  for (const animal of animals) {
    let animalCostEntry = await AnimalCost.findOne({
      animalTagId: animal.tagId,
    });

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
      shedEntry: {
        _id: shedEntry._id,
        locationShed: shedEntry.locationShed,
        owner: shedEntry.owner,
        feeds: shedEntry.feeds,
        createdAt: shedEntry.createdAt,
        __v: shedEntry.__v,
      },
      totalFeedCost,
      perAnimalFeedCost,
    },
  });
});



// const updateFeedToShed = asyncwrapper(async (req, res, next) => {
//   const userId = req.userId; // Get the user ID from the token
//   const shedEntryId = req.params.feedShedId; // ID of the ShedEntry to update
//   const updatedData = req.body; // Data to update

//   // Find the existing shed entry document
//   let shedEntry = await ShedEntry.findOne({ _id: shedEntryId, owner: userId });
//   if (!shedEntry) {
//     const error = AppError.create(
//       "Shed entry not found or unauthorized to update",
//       404,
//       httpstatustext.FAIL
//     );
//     return next(error);
//   }

//   // Check if feed name is provided and replace it with the corresponding feed ID
//   if (updatedData.feedName) {
//     const feed = await Feed.findOne({ name: updatedData.feedName });
//     if (!feed) {
//       const error = AppError.create(
//         `Feed with name "${updatedData.feedName}" not found`,
//         404,
//         httpstatustext.FAIL
//       );
//       return next(error);
//     }
//     updatedData.feed = feed._id; // Replace feedName with feed ID
//     shedEntry.feed = feed._id; // Update the feed in the ShedEntry document
//   }

//   // Update top-level fields in the shed entry
//   Object.assign(shedEntry, updatedData);

//   // If `quantity` or `feed` is updated, recalculate costs
//   if (updatedData.quantity || updatedData.feed) {
//     const feed = await Feed.findById(shedEntry.feed);
//     if (!feed) {
//       const error = AppError.create(
//         `Feed with ID "${shedEntry.feed}" not found`,
//         404,
//         httpstatustext.FAIL
//       );
//       return next(error);
//     }

//     shedEntry.quantity = updatedData.quantity || shedEntry.quantity;
//     shedEntry.feedCost = feed.price * shedEntry.quantity;

//     // Debug: Log calculation process
//     //  console.log(`Updated feed cost: ${shedEntry.feedCost} (Price: ${feed.price}, Quantity: ${shedEntry.quantity})`);
//   }

//   // Save the updated shed entry document
//   await shedEntry.save();

//   // Instead of aggregation, calculate total feed cost directly from shed entries
//   const animals = await Animal.find({ locationShed: shedEntry.locationShed });
//   const shedEntries = await ShedEntry.find({
//     locationShed: shedEntry.locationShed,
//     owner: userId,
//   });

//   // Fetch all feeds in one go to avoid multiple DB calls
//   const feedIds = shedEntries.map((entry) => entry.feed);
//   const feeds = await Feed.find({ _id: { $in: feedIds } }).select("price _id");

//   const feedMap = feeds.reduce((map, feed) => {
//     map[feed._id] = feed.price; // Create a mapping of feed ID to its price
//     return map;
//   }, {});

//   // Calculate total feed cost manually based on quantity and price
//   const totalFeedCost = shedEntries.reduce((sum, entry) => {
//     const feedPrice = feedMap[entry.feed]; // Get the price of the current feed
//     const cost = (feedPrice || 0) * entry.quantity; // Calculate the cost for this entry
//     return sum + cost; // Add to total
//   }, 0);

//   // console.log('Total Feed Cost:', totalFeedCost);  // Log the total feed cost for debugging

//   // Calculate per animal feed cost
//   const perAnimalFeedCost =
//     animals.length > 0 ? totalFeedCost / animals.length : 0; // Handle case when no animals are present

//   for (const animal of animals) {
//     let animalCostEntry = await AnimalCost.findOne({
//       animalTagId: animal.tagId,
//     });

//     if (animalCostEntry) {
//       animalCostEntry.feedCost = perAnimalFeedCost;
//     } else {
//       animalCostEntry = new AnimalCost({
//         animalTagId: animal.tagId,
//         feedCost: perAnimalFeedCost,
//         treatmentCost: 0,
//         date: shedEntry.date,
//         owner: userId,
//       });
//     }

//     // Validate feedCost before saving
//     if (typeof animalCostEntry.feedCost !== "number") {
//       const error = AppError.create(
//         "Invalid feedCost calculated",
//         400,
//         httpstatustext.FAIL
//       );
//       return next(error);
//     }

//     await animalCostEntry.save();
//   }

//   // Populate the response to include feed name and price
//   const updatedShedEntry = await ShedEntry.findById(shedEntry._id).populate({
//     path: "feed",
//     select: "name price",
//   });

//   res.json({
//     status: httpstatustext.SUCCESS,
//     data: { shedEntry: updatedShedEntry },
//   });
// });

// const getallfeedsbyshed1 = asyncwrapper(async (req, res) => {

//   const userId = req.userId;
//   const query = req.query;
//   const limit = query.limit || 10;
//   const page = query.page || 1;
//   const skip = (page - 1) * limit;

//   const filter = { owner: userId };

//   if (query.locationShed) {
//     filter.locationShed = query.locationShed;
//   }

//   if (query.date) {
//     filter.date = query.date;
//   }

//   const feedShed = await ShedEntry.find(filter, { __v: false })
//     .populate({
//       path: "feed", // Populate the feed field
//       select: "name price", // Select only the name and price fields
//     })
//     .limit(limit)
//     .skip(skip);

//   // Map the populated data for a cleaner response
//   const response = feedShed.map((entry) => ({
//     _id: entry._id,
//     locationShed: entry.locationShed,
//     quantity: entry.quantity,
//     date: entry.date,
//     feedName: entry.feed?.name, // Feed name from the populated data
//     feedPrice: entry.feed?.price, // Feed price from the populated data
//   }));

//   res.json({
//     status: httpstatustext.SUCCESS,
//     data: { feedShed: response },
//   });
// });

const updateFeedToShed1 = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const { shedEntryId, locationShed, feeds, date } = req.body;

  if (!shedEntryId) {
    return res.status(400).json({
      status: "FAILURE",
      message: "shedEntryId is required.",
    });
  }

  const shedEntry = await ShedEntry.findOne({ _id: shedEntryId, owner: userId });
  if (!shedEntry) {
    return res.status(404).json({
      status: "FAILURE",
      message: "Shed entry not found.",
    });
  }

  if (locationShed) {
    shedEntry.locationShed = locationShed;
  }

  const previousFeeds = [...shedEntry.feeds];

  if (feeds) {
    if (!Array.isArray(feeds) || feeds.length === 0) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Feeds (array) must be provided and cannot be empty.",
      });
    }

    const updatedFeeds = [];
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

      updatedFeeds.push({
        feedId: feed._id,
        feedName: feedName,
        quantity: quantity,
      });
    }

    shedEntry.feeds = updatedFeeds;

    const animals = await Animal.find({ locationShed: shedEntry.locationShed });
    if (animals.length === 0) {
      return res.status(404).json({
        status: "FAILURE",
        message: `No animals found in shed "${shedEntry.locationShed}".`,
      });
    }

    const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);
    const perAnimalFeedCost = totalFeedCost / animals.length;

    for (const animal of animals) {
      let animalCostEntry = await AnimalCost.findOne({ animalTagId: animal.tagId });

      if (animalCostEntry) {
        animalCostEntry.feedCost = perAnimalFeedCost; // Update feed cost
      } else {
        animalCostEntry = new AnimalCost({
          animalTagId: animal.tagId,
          feedCost: perAnimalFeedCost,
          treatmentCost: 0,
          date: date || Date.now(),
          owner: userId,
        });
      }

      await animalCostEntry.save();
    }
  }

  if (date) {
    shedEntry.date = new Date(date);
  }

  await shedEntry.save();

  res.status(200).json({
    status: "SUCCESS",
    data: {
      shedEntry: {
        _id: shedEntry._id,
        locationShed: shedEntry.locationShed,
        owner: shedEntry.owner,
        feeds: shedEntry.feeds,
        date: shedEntry.date,
        createdAt: shedEntry.createdAt,
        __v: shedEntry.__v,
      },
    },
  });
});

const updateFeedToSheddd = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const { feeds, date, locationShed } = req.body;
  const { shedEntryId } = req.params;  // Fetch shedEntryId from params

  if (!shedEntryId || !Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({
      status: "FAILURE",
      message: "shedEntryId and feeds (array) are required.",
    });
  }

  // Fetch the shed entry using shedEntryId from params
  const shedEntry = await ShedEntry.findById(shedEntryId);
  if (!shedEntry) {
    return res.status(404).json({
      status: "FAILURE",
      message: `Shed entry with ID "${shedEntryId}" not found.`,
    });
  }

  // Optionally update locationShed if provided
  if (locationShed) {
    shedEntry.locationShed = locationShed;
  }

  // Fetch animals at the shed location
  const animals = await Animal.find({ locationShed: shedEntry.locationShed });
  if (animals.length === 0) {
    return res.status(404).json({
      status: "FAILURE",
      message: `No animals found in shed "${shedEntry.locationShed}".`,
    });
  }

  const feedCosts = [];
  const allFeeds = [];

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

    // Include feedId in the allFeeds array
    allFeeds.push({
      feedId: feed._id,
      feedName: feedName,
      quantity: quantity,
    });
  }

  // Total feed cost calculations
  const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);
  const perAnimalFeedCost = totalFeedCost / animals.length;

  // Update the shed entry feeds, date, and locationShed if provided
  shedEntry.feeds = allFeeds;
  if (date) shedEntry.date = new Date(date);

  await shedEntry.save();

  // Update the feed costs for each animal
  for (const animal of animals) {
    let animalCostEntry = await AnimalCost.findOne({
      animalTagId: animal.tagId,
    });

    if (animalCostEntry) {
      animalCostEntry.feedCost = perAnimalFeedCost; // Replace old cost with new
    } else {
      animalCostEntry = new AnimalCost({
        animalTagId: animal.tagId,
        feedCost: perAnimalFeedCost,
        treatmentCost: 0, // Default treatment cost
        date: date || Date.now(),
        owner: userId,
      });
    }

    await animalCostEntry.save();
  }

  res.status(200).json({
    status: "SUCCESS",
    data: {
      shedEntry: {
        _id: shedEntry._id,
        locationShed: shedEntry.locationShed,
        owner: shedEntry.owner,
        feeds: shedEntry.feeds,
        createdAt: shedEntry.createdAt,
        __v: shedEntry.__v,
      },
      totalFeedCost,
      perAnimalFeedCost,
    },
  });
});


const updateFeedToShed = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const { feeds, date, locationShed } = req.body;
  const { shedEntryId } = req.params;  // Fetch shedEntryId from params

  if (!shedEntryId || !Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({
      status: "FAILURE",
      message: "shedEntryId and feeds (array) are required.",
    });
  }

  // Fetch the shed entry using shedEntryId from params
  const shedEntry = await ShedEntry.findById(shedEntryId);
  if (!shedEntry) {
    return res.status(404).json({
      status: "FAILURE",
      message: `Shed entry with ID "${shedEntryId}" not found.`,
    });
  }

  // Optionally update locationShed if provided
  if (locationShed) {
    shedEntry.locationShed = locationShed;
  }

  // Fetch animals at the shed location
  const animals = await Animal.find({ locationShed: shedEntry.locationShed });
  if (animals.length === 0) {
    return res.status(404).json({
      status: "FAILURE",
      message: `No animals found in shed "${shedEntry.locationShed}".`,
    });
  }

  const feedCosts = [];
  const allFeeds = [];

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

    // Include feedId in the allFeeds array
    allFeeds.push({
      feedId: feed._id,
      feedName: feedName,
      quantity: quantity,
    });

    // Get previous quantity for this feed (defaults to 0 if not found)
    const previousQuantity = shedEntry.feeds.find((entry) => entry.feedId.toString() === feed._id.toString())?.quantity || 0;

    // Update the stock based on the difference
    if (previousQuantity !== quantity) {
      // Calculate the difference in quantity
      const quantityDifference = quantity - previousQuantity;

      // Update the stock accordingly
      const feedInStock = await Feed.findById(feed._id);
      if (feedInStock) {
        feedInStock.stock = feedInStock.stock - quantityDifference; // Update stock based on the difference
        await feedInStock.save();
      }
    }
  }

  // Total feed cost calculations
  const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);
  const perAnimalFeedCost = totalFeedCost / animals.length;

  // Update the shed entry feeds, date, and locationShed if provided
  shedEntry.feeds = allFeeds;
  if (date) shedEntry.date = new Date(date);

  await shedEntry.save();  // Save the shed entry with updated feeds

  // Update the feed costs for each animal
  for (const animal of animals) {
    let animalCostEntry = await AnimalCost.findOne({
      animalTagId: animal.tagId,
    });

    if (animalCostEntry) {
      animalCostEntry.feedCost = perAnimalFeedCost; // Replace old cost with new
    } else {
      animalCostEntry = new AnimalCost({
        animalTagId: animal.tagId,
        feedCost: perAnimalFeedCost,
        treatmentCost: 0, // Default treatment cost
        date: date || Date.now(),
        owner: userId,
      });
    }

    await animalCostEntry.save();
  }

  res.status(200).json({
    status: "SUCCESS",
    data: {
      shedEntry: {
        _id: shedEntry._id,
        locationShed: shedEntry.locationShed,
        owner: shedEntry.owner,
        feeds: shedEntry.feeds,
        createdAt: shedEntry.createdAt,
        __v: shedEntry.__v,
      },
      totalFeedCost,
      perAnimalFeedCost,
    },
  });
});


const getAllFeedsByShed = asyncwrapper(async (req, res) => {
  const userId = req.userId;
  const query = req.query;
  const limit = parseInt(query.limit, 10) || 10;
  const page = parseInt(query.page, 10) || 1;
  const skip = (page - 1) * limit;

  const filter = { owner: userId };

  if (query.locationShed) {
    filter.locationShed = query.locationShed;
  }

  if (query.date) {
    filter.date = query.date;
  }

  // Get the total count of documents that match the filter
  const totalCount = await ShedEntry.countDocuments(filter);

  // Find ShedEntries with pagination
  const feedShed = await ShedEntry.find(filter, { __v: false })
    .populate({
      path: "feeds.feedId", // Populate feedId in the feeds array
      select: "name price", // Select only the name and price fields from Feed
    })
    .limit(limit)
    .skip(skip);

  // Transform the data for a cleaner response
  const response = feedShed.map((entry) => ({
    _id: entry._id,
    locationShed: entry.locationShed,
    date: entry.date,
    feeds: entry.feeds.map((feed) => ({
      feedName: feed.feedId?.name, // Feed name from populated data
      feedPrice: feed.feedId?.price, // Feed price from populated data
      quantity: feed.quantity, // Quantity specific to this ShedEntry
    })),
  }));

  res.json({
    status: httpstatustext.SUCCESS,
    data: {
      feedShed: response,
      pagination: {
        total: totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    },
  });
});

const getsniglefeedShed = asyncwrapper(async (req, res, next) => {
  const feedShed = await ShedEntry.findById(req.params.feedShedId).populate({
    path: "feed", // Populate the feed field
    select: "name price", // Select only the name and price fields
  });

  if (!feedShed) {
    const error = AppError.create(
      "Feed shed entry not found",
      404,
      httpstatustext.FAIL
    );
    return next(error);
  }

  // Format the response to include feed name and price
  const response = {
    _id: feedShed._id,
    locationShed: feedShed.locationShed,
    quantity: feedShed.quantity,
    date: feedShed.date,
    feedName: feedShed.feed?.name, // Feed name from the populated data
    feedPrice: feedShed.feed?.price, // Feed price from the populated data
  };

  return res.json({
    status: httpstatustext.SUCCESS,
    data: { feedShed: response },
  });
});

const deletefeedshed = asyncwrapper(async (req, res) => {
  const userId = req.userId; // Get the user ID from the token

  // Delete the ShedEntry
  const deletedEntry = await ShedEntry.findByIdAndDelete(req.params.feedShedId);
  if (!deletedEntry) {
    const error = AppError.create(
      "Shed entry not found or unauthorized to delete",
      404,
      httpstatustext.FAIL
    );
    return next(error);
  }

  // If the entry was deleted successfully, recalculate total feed cost
  const animals = await Animal.find({
    locationShed: deletedEntry.locationShed,
  });
  const shedEntries = await ShedEntry.find({
    locationShed: deletedEntry.locationShed,
    owner: userId,
  });

  // Fetch all feeds associated with remaining entries
  const feedIds = shedEntries.map((entry) => entry.feed);
  const feeds = await Feed.find({ _id: { $in: feedIds } }).select("price _id");

  const feedMap = feeds.reduce((map, feed) => {
    map[feed._id] = feed.price; // Create a mapping of feed ID to its price
    return map;
  }, {});

  // Recalculate total feed cost based on remaining shed entries
  const totalFeedCost = shedEntries.reduce((sum, entry) => {
    const feedPrice = feedMap[entry.feed]; // Get the price of the current feed
    const cost = (feedPrice || 0) * entry.quantity; // Calculate the cost for this entry
    return sum + cost; // Add to total
  }, 0);

  // Calculate per animal feed cost
  const perAnimalFeedCost = totalFeedCost / (animals.length || 1);

  // Update AnimalCost for each animal
  for (const animal of animals) {
    let animalCostEntry = await AnimalCost.findOne({
      animalTagId: animal.tagId,
    });

    if (animalCostEntry) {
      animalCostEntry.feedCost = perAnimalFeedCost; // Update existing feed cost
    } else {
      animalCostEntry = new AnimalCost({
        animalTagId: animal.tagId,
        feedCost: perAnimalFeedCost,
        treatmentCost: 0,
        date: new Date(), // Use the current date or appropriate date
        owner: userId,
      });
    }

    await animalCostEntry.save();
  }

  // Respond with a success message
  res.status(200).json({ status: httpstatustext.SUCCESS, data: null });
});



// --------------------------------------fodder ------------------------


// const manufactureFodder = asyncwrapper(async (req, res, next) => {
//   const userId = req.userId;
//   const { feeds, name } = req.body;  // Expecting an array of feed IDs and their quantities

//   // Validate the inputs
//   if (!Array.isArray(feeds) || feeds.length === 0) {
//     return next(AppError.create("You must provide at least one feed", 400, httpstatustext.FAIL));
//   }

//   let totalQuantity = 0;
//   let totalPrice = 0; // Initialize total price
//   const fodderComponents = [];

//   // Loop through each feed to create fodder, subtract the stock, and calculate price
//   for (let i = 0; i < feeds.length; i++) {
//     const feed = await Feed.findById(feeds[i].feedId);
//     if (!feed) {
//       return next(AppError.create(`Feed with ID ${feeds[i].feedId} not found`, 404, httpstatustext.FAIL));
//     }

//     if (feed.owner.toString() !== userId.toString()) {
//       return next(AppError.create("You are not authorized to use this feed", 403, httpstatustext.FAIL));
//     }

//     const quantityToUse = feeds[i].quantity;
    
//     // Ensure there is enough quantity in stock
//     if (feed.quantity < quantityToUse) {
//       return next(AppError.create(`Not enough stock for feed ${feed.name}`, 400, httpstatustext.FAIL));
//     }

//     // Update feed stock by subtracting the quantity used
//     feed.quantity -= quantityToUse;
//     await feed.save();

//     // Calculate price for this feed (quantity * price)
//     const feedPrice = feed.price || 0; // If price is not set, default to 0
//     totalPrice += feedPrice * quantityToUse;

//     // Add the feed to fodder components
//     fodderComponents.push({ feedId: feed._id, quantity: quantityToUse });
//     totalQuantity += quantityToUse;
//   }

//   // Create a new fodder document with the components, total quantity, and price
//   const newFodder = new Fodder({
//     name,
//     components: fodderComponents,
//     totalQuantity,
//     totalPrice, // Store the calculated price in the fodder document
//     owner: userId
//   });

//   await newFodder.save();

//   res.json({
//     status: httpstatustext.SUCCESS,
//     data: { fodder: newFodder },
//   });
// });
const getAllFodders = asyncwrapper(async (req, res) => {
  const userId = req.userId;
  const query = req.query;
  const limit = query.limit || 10;
  const page = query.page || 1;
  const skip = (page - 1) * limit;
  const filter = { owner: userId };

  if (query.name) {
    filter.name = query.name;
  }
  const fodders = await Fodder.find(filter, { __v: false }).limit(limit).skip(skip);
  const total = await Fodder.countDocuments(filter);
   const totalPages = Math.ceil(total / limit);

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
    data: { fodders },
  });
});


const getSingleFodder = asyncwrapper(async (req, res, next) => {
  const fodder = await Fodder.findById(req.params.fodderId);
  if (!fodder) {
    return next(AppError.create("Fodder not found", 404, httpstatustext.FAIL));
  }
  res.json({
    status: httpstatustext.SUCCESS,
    data: { fodder },
  });
});

const manufactureFodder = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const { feeds, name } = req.body;  // Expecting an array of feed IDs and their quantities

  // Validate the inputs
  if (!Array.isArray(feeds) || feeds.length === 0) {
    return next(AppError.create("You must provide at least one feed", 400, httpstatustext.FAIL));
  }

  let totalQuantity = 0;
  let totalPrice = 0; // Initialize total price
  const fodderComponents = [];

  // Loop through each feed to create fodder, subtract the stock, and calculate price
  for (let i = 0; i < feeds.length; i++) {
    const feed = await Feed.findById(feeds[i].feedId);
    if (!feed) {
      return next(AppError.create(`Feed with ID ${feeds[i].feedId} not found`, 404, httpstatustext.FAIL));
    }

    if (feed.owner.toString() !== userId.toString()) {
      return next(AppError.create("You are not authorized to use this feed", 403, httpstatustext.FAIL));
    }

    const quantityToUse = feeds[i].quantity;
    
    // Ensure there is enough quantity in stock
    if (feed.quantity < quantityToUse) {
      return next(AppError.create(`Not enough stock for feed ${feed.name}`, 400, httpstatustext.FAIL));
    }

    // Update feed stock by subtracting the quantity used
    feed.quantity -= quantityToUse;
    await feed.save();

    // Calculate price for this feed (quantity * price)
    const feedPrice = feed.price || 0; // If price is not set, default to 0
    totalPrice += feedPrice * quantityToUse;

    // Add the feed to fodder components
    fodderComponents.push({ feedId: feed._id, quantity: quantityToUse });
    totalQuantity += quantityToUse;
  }

  // Create the new Fodder document
  const newFodder = new Fodder({
    name,
    components: fodderComponents,
    totalQuantity,
    totalPrice,
    owner: userId
  });

  // Save the new fodder to the Fodder collection
  await newFodder.save();

  // Create a new feed (treated as fodder) with the calculated total quantity and price
  const newFeed = new Feed({
    name,  // Name of the new fodder
    type: 'mixed fodder',  // You can set the type to 'fodder' or any other classification you prefer
    quantity: totalQuantity,  // The total quantity of the fodder created
    price: totalPrice,  // The total price of the fodder
    concentrationOfDryMatter: 0,  // You can set this if needed
    owner: userId,  // Owner is the same as the user making the fodder
    fodders: fodderComponents,  // Add the components of the original feeds
  });

  // Save the new feed to the Feed collection
  await newFeed.save();

  res.json({
    status: httpstatustext.SUCCESS,
    data: { feed: newFeed, fodder: newFodder },  // Return both the new feed (treated as fodder) and the new fodder document
  });
});

const updateFodder = asyncwrapper(async (req, res, next) => {  
  const userId = req.userId;  
  const { name, feeds } = req.body;  // Expecting an array of feed IDs and their quantities  
  const fodderId = req.params.fodderId; // Assuming fodderId is passed in the URL parameters  

  // Validate the inputs  
  if (!fodderId) {  
    return next(AppError.create("Fodder ID is required", 400, httpstatustext.FAIL));  
  }  

  if (!Array.isArray(feeds) || feeds.length === 0) {  
    return next(AppError.create("You must provide at least one feed", 400, httpstatustext.FAIL));  
  }  

  const updatedFodder = await Fodder.findById(fodderId).populate('components.feedId'); // Retrieve existing fodder  
  if (!updatedFodder) {  
    return next(AppError.create(`Fodder with ID ${fodderId} not found`, 404, httpstatustext.FAIL));  
  }  

  let totalQuantity = 0;  
  let totalPrice = 0; // Initialize total price  
  const fodderComponents = [];  

  // Loop through each feed to update fodder, subtract the stock, and calculate price  
  for (const feedItem of feeds) {  
    const feed = await Feed.findById(feedItem.feedId);  
    if (!feed) {  
      return next(AppError.create(`Feed with ID ${feedItem.feedId} not found`, 404, httpstatustext.FAIL));  
    }  

    if (feed.owner.toString() !== userId.toString()) {  
      return next(AppError.create("You are not authorized to use this feed", 403, httpstatustext.FAIL));  
    }  

    const quantityToUse = feedItem.quantity;  

    // Ensure there is enough quantity in stock  
    if (feed.quantity < quantityToUse) {  
      return next(AppError.create(`Not enough stock for feed ${feed.name}`, 400, httpstatustext.FAIL));  
    }  

    // Update feed stock by subtracting the quantity used  
    feed.quantity -= quantityToUse;  
    await feed.save();  

    // Calculate price for this feed (quantity * price)  
    const feedPrice = feed.price || 0; // If price is not set, default to 0  
    totalPrice += feedPrice * quantityToUse;  

    // Add the feed to fodder components  
    fodderComponents.push({ feedId: feed._id, quantity: quantityToUse });  
    totalQuantity += quantityToUse;  
  }  

  // Update the existing fodder document  
  updatedFodder.name = name; // Update name if provided  
  updatedFodder.components = fodderComponents; // Update components  
  updatedFodder.totalQuantity = totalQuantity; // Update total quantity  
  updatedFodder.totalPrice = totalPrice; // Update total price  

  // Save the updated fodder  
  await updatedFodder.save();  

  // Create or update the feed (treated as fodder) with the updated total quantity and price  
  let feedFodder = await Feed.findOne({ name, type: 'mixed fodder', owner: userId });  
  
  if (!feedFodder) {  
    // If the feed does not exist, create a new one  
    feedFodder = new Feed({  
      name,  // Name of the new fodder  
      type: 'mixed fodder',  // Classification  
      quantity: totalQuantity,  // The total quantity of the fodder created  
      price: totalPrice,  // The total price of the fodder  
      concentrationOfDryMatter: 0,  // You can set this if needed  
      owner: userId,  // Owner is the current user  
      fodders: fodderComponents,  // Add components of the original feeds  
    });  
  } else {  
    // If it exists, update the existing feed  
    feedFodder.quantity = totalQuantity;  
    feedFodder.price = totalPrice;  
    feedFodder.fodders = fodderComponents; // Update components as well  
  }  

  // Save the new or updated feed to the Feed collection  
  await feedFodder.save();  

  res.json({  
    status: httpstatustext.SUCCESS,  
    data: { feed: feedFodder, fodder: updatedFodder }, // Return both the feed and the updated fodder document  
  });  
});



const deleteFodder = asyncwrapper(async (req, res, next) => {
  const { fodderId } = req.params;

  const fodder = await Fodder.findByIdAndDelete(fodderId);


  res.json({
    status: httpstatustext.SUCCESS,
    message: "Fodder deleted successfully",
  });
});



module.exports = {
  getallfeeds,
  getsniglefeed,
  addfeed,
  updatefeed,
  deletefeed,
  addFeedToShed,
  getAllFeedsByShed,
  deletefeedshed,
  getsniglefeedShed,
  updateFeedToShed,
  manufactureFodder,
  getSingleFodder,
  getAllFodders,
  deleteFodder,
  updateFodder,
  getfeeds
};
