const Feed = require("../Models/feed.model");
const Fodder=require("../Models/fodder.model");
const httpstatustext = require("../utilits/httpstatustext");
const asyncwrapper = require("../middleware/asyncwrapper");
const AppError = require("../utilits/AppError");
const User = require("../Models/user.model");
const LocationShed = require('../Models/locationsed.model');
const ShedEntry = require("../Models/shedFeed.model");
const AnimalCost = require("../Models/animalCost.model");
const Animal = require("../Models/animal.model");
const mongoose = require("mongoose");
const { ConsoleMessage } = require("puppeteer");

const getallfeeds = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
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
  const userId = req.user.id;
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
  const userId = req.user.id;

  const newfeed = new Feed({ ...req.body, owner: userId });
  await newfeed.save();
  res.json({ status: httpstatustext.SUCCESS, data: { feed: newfeed } });
});

const updatefeed = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
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

const addFeedToShed = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const { locationShed, feeds, date } = req.body;

  if (!locationShed || !Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({
      status: "FAILURE",
      message: "locationShed and feeds (array) are required.",
    });
  }

  // Find the locationShed document by its ID
  const shed = await LocationShed.findById(locationShed);
  if (!shed) {
    return res.status(404).json({
      status: "FAILURE",
      message: `Location shed with ID "${locationShed}" not found.`,
    });
  }

  // Find animals in the specified locationShed
  const animals = await Animal.find({ locationShed });
  if (animals.length === 0) {
    return res.status(404).json({
      status: "FAILURE",
      message: `No animals found in shed "${shed.locationShedName}".`,
    });
  }

  const feedCosts = [];
  const allFeeds = [];

  for (const feedItem of feeds) {
    const { feedId, quantity } = feedItem;

    if (!feedId || !quantity) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each feed must have feedId and quantity.",
      });
    }

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

    if (feed.quantity < quantity) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Not enough stock for feed "${feed.name}". Available: ${feed.quantity}, Requested: ${quantity}.`,
      });
    }

    feed.quantity -= quantity;
    await feed.save();
    const feedCost = feed.price * quantity;
    feedCosts.push({ feed: feed._id, quantity, cost: feedCost });

    allFeeds.push({
      feedId: feed._id,
      feedName: feed.name,
      quantity: quantity,
    });
  }

  const totalFeedCost = feedCosts.reduce((sum, item) => sum + item.cost, 0);
  const perAnimalFeedCost = totalFeedCost / animals.length;

  const shedEntry = new ShedEntry({
    locationShed: shed._id, // Store the locationShed ID
    owner: userId,
    feeds: allFeeds,
    date: date ? new Date(date) : Date.now(),
  });

  await shedEntry.save();

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
        treatmentCost: 0,
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
        locationShed: {
          _id: shed._id,
          locationShedName: shed.locationShedName, // Include locationShedName in the response
        },
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { shedEntryId } = req.params;
    const { locationShed, feeds, date } = req.body;

    if (!shedEntryId || !locationShed || !Array.isArray(feeds) || feeds.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        status: "FAILURE",
        message: "shedEntryId, locationShed, and feeds (array) are required.",
      });
    }

    const shed = await LocationShed.findById(locationShed).session(session);
    if (!shed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: "FAILURE",
        message: `Location shed with ID "${locationShed}" not found.`,
      });
    }

    const existingShedEntry = await ShedEntry.findById(shedEntryId).session(session);
    if (!existingShedEntry) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: "FAILURE",
        message: `Shed entry with ID "${shedEntryId}" not found.`,
      });
    }

    const animals = await Animal.find({ locationShed }).session(session);
    if (animals.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: "FAILURE",
        message: `No animals found in shed "${shed.locationShedName}".`,
      });
    }

    for (const feedItem of feeds) {
      const { feedId, quantity: newQuantity } = feedItem;

      if (!feedId || !newQuantity || isNaN(newQuantity) || newQuantity <= 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: "Each feed must have a valid feedId and quantity.",
        });
      }

      const oldFeed = existingShedEntry.feeds.find((feed) => feed.feedId.toString() === feedId);
      if (!oldFeed) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: `Feed with ID "${feedId}" not found in the shed entry.`,
        });
      }

      const oldQuantity = oldFeed.quantity;

      const feed = await Feed.findById(feedId).session(session);
      if (!feed) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: `Feed with ID "${feedId}" not found.`,
        });
      }

      if (feed.owner.toString() !== userId.toString()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          status: "FAILURE",
          message: "You are not authorized to use this feed.",
        });
      }

      const quantityDifference = newQuantity - oldQuantity;

      if (quantityDifference > 0) {
        if (feed.quantity < quantityDifference) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "FAILURE",
            message: `Not enough stock for feed "${feed.name}". Available: ${feed.quantity}, Required: ${quantityDifference}.`,
          });
        }
        feed.quantity -= quantityDifference;
      } else if (quantityDifference < 0) {
        feed.quantity += Math.abs(quantityDifference);
      }

      await feed.save({ session });

      oldFeed.quantity = newQuantity;
    }

    existingShedEntry.date = new Date(date);
    await existingShedEntry.save({ session });

    const totalFeedCost = await existingShedEntry.feeds.reduce(async (sumPromise, feed) => {
      const sum = await sumPromise;
      const feedData = await Feed.findById(feed.feedId).session(session);
      if (!feedData) {
        throw new Error(`Feed with ID "${feed.feedId}" not found.`);
      }
      const feedCost = feedData.price * feed.quantity;
      return sum + feedCost;
    }, Promise.resolve(0));

    if (isNaN(totalFeedCost)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        status: "FAILURE",
        message: "Failed to calculate total feed cost.",
      });
    }

    const perAnimalFeedCost = totalFeedCost / animals.length;

    if (isNaN(perAnimalFeedCost)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        status: "FAILURE",
        message: "Failed to calculate per animal feed cost.",
      });
    }

    for (const animal of animals) {
      let animalCostEntry = await AnimalCost.findOne({
        animalTagId: animal.tagId,
      }).session(session);

      if (animalCostEntry) {
        animalCostEntry.feedCost = perAnimalFeedCost;
      } else {
        animalCostEntry = new AnimalCost({
          animalTagId: animal.tagId,
          feedCost: perAnimalFeedCost,
          treatmentCost: 0,
          date: date,
          owner: userId,
        });
      }

      await animalCostEntry.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "SUCCESS",
      message: "Shed entry updated successfully.",
      data: {
        shedEntry: {
          _id: existingShedEntry._id,
          locationShed: {
            _id: shed._id,
            locationShedName: shed.locationShedName,
          },
          owner: existingShedEntry.owner,
          feeds: existingShedEntry.feeds,
          date: existingShedEntry.date,
        },
        totalFeedCost,
        perAnimalFeedCost,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating shed entry:", error);
    next(error);
  }
});

const getAllFeedsByShed = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
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

  const totalCount = await ShedEntry.countDocuments(filter);

  const feedShed = await ShedEntry.find(filter, { __v: false })
    .populate({
      path: "feeds.feedId",
      select: "name price",
    })
    .populate({
      path: "locationShed",
      select: "locationShedName", // Populate locationShedName
    })
    .limit(limit)
    .skip(skip);

  const response = feedShed.map((entry) => ({
    _id: entry._id,
    locationShed: entry.locationShed ? {
      _id: entry.locationShed._id,
      locationShedName: entry.locationShed.locationShedName,
    } : null,
    date: entry.date,
    feeds: entry.feeds.map((feed) => ({
      feedName: feed.feedId?.name,
      feedPrice: feed.feedId?.price,
      quantity: feed.quantity,
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
  try {
    const feedShed = await ShedEntry.findById(req.params.feedShedId)
      .populate({
        path: "feeds.feedId",
        select: "name price",
      })
      .populate({
        path: "locationShed",
        select: "locationShedName", // Populate locationShedName
      });

    if (!feedShed) {
      const error = AppError.create(
        "Feed shed entry not found",
        404,
        httpstatustext.FAIL
      );
      return next(error);
    }

    const response = {
      _id: feedShed._id,
      locationShed: feedShed.locationShed ? {
        _id: feedShed.locationShed._id,
        locationShedName: feedShed.locationShed.locationShedName,
      } : null,
      date: feedShed.date,
      feeds: feedShed.feeds.map((feed) => ({
        feedId: feed.feedId._id,
        feedName: feed.feedId.name,
        price: feed.feedId.price,
        quantity: feed.quantity,
      })),
    };

    return res.json({
      status: httpstatustext.SUCCESS,
      data: { feedShed: response },
    });
  } catch (error) {
    console.error("Error fetching feed shed:", error);
    next(error);
  }
});
const deletefeedshed = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id; // Get the user ID from the token
  const feedShedId = req.params.feedShedId; // Get the feedShedId from the request parameters

  // Step 1: Find and delete the ShedEntry
  const deletedEntry = await ShedEntry.findByIdAndDelete(feedShedId);
  if (!deletedEntry) {
    const error = AppError.create(
      "Shed entry not found or unauthorized to delete",
      404,
      httpstatustext.FAIL
    );
    return next(error);
  }

  // Step 2: Restore the feed quantities
  for (const feedItem of deletedEntry.feeds) {
    const { feedId, quantity } = feedItem;

    // Find the feed and restore its quantity
    const feed = await Feed.findById(feedId);
    if (feed) {
      feed.quantity += quantity; // Add back the deducted quantity
      await feed.save();
    }
  }

  // Step 3: Recalculate total feed cost and per animal feed cost for the remaining entries
  const animals = await Animal.find({
    locationShed: deletedEntry.locationShed,
  });

  const shedEntries = await ShedEntry.find({
    locationShed: deletedEntry.locationShed,
    owner: userId,
  });

  // Fetch all feeds associated with remaining entries
  const feedIds = shedEntries.flatMap((entry) =>
    entry.feeds.map((feed) => feed.feedId)
  );
  const feeds = await Feed.find({ _id: { $in: feedIds } }).select("price _id");

  // Create a mapping of feed ID to its price
  const feedMap = feeds.reduce((map, feed) => {
    map[feed._id] = feed.price;
    return map;
  }, {});

  // Recalculate total feed cost based on remaining shed entries
  const totalFeedCost = shedEntries.reduce((sum, entry) => {
    const entryCost = entry.feeds.reduce((entrySum, feedItem) => {
      const feedPrice = feedMap[feedItem.feedId]; // Get the price of the current feed
      const cost = (feedPrice || 0) * feedItem.quantity; // Calculate the cost for this feed item
      return entrySum + cost;
    }, 0);
    return sum + entryCost; // Add to total
  }, 0);

  // Calculate per animal feed cost
  const perAnimalFeedCost = totalFeedCost / (animals.length || 1);

  // Step 4: Update AnimalCost for each animal
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

  // Step 5: Respond with a success message
  res.status(200).json({ status: httpstatustext.SUCCESS, data: null });
});


// --------------------------------------fodder ------------------------

const getAllFodders = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
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
  try {
    // Fetch the fodder by ID and populate relevant fields
    const fodder = await Fodder.findById(req.params.fodderId).populate({
      path: "components.feedId", // المسار الصحيح للعلف
      select: "name price", // الحقول المطلوبة
    });

    if (!fodder) {
      return next(AppError.create("Fodder not found", 404, httpstatustext.FAIL));
    }

    // Format the response to include feed details
    const response = {
      _id: fodder._id,
      name: fodder.name,
      totalQuantity: fodder.totalQuantity,
      totalPrice: fodder.totalPrice,
      owner: fodder.owner,
      components: fodder.components.map((component) => ({
        feedId: component.feedId._id,
        feedName: component.feedId.name, // اسم العلف
        price: component.feedId.price, // سعر العلف
        quantity: component.quantity, // الكمية المستخدمة
      })),
    };

    return res.json({
      status: httpstatustext.SUCCESS,
      data: { fodder: response },
    });
  } catch (error) {
    console.error("Error fetching fodder:", error);
    next(error);
  }
});

const manufactureFodder = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { fodderId } = req.params; // معرف العلف المصنع
    const { feeds, name } = req.body; // بيانات التحديث

    // التحقق من صحة البيانات
    if (!fodderId || !Array.isArray(feeds) || feeds.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return next(AppError.create("fodderId and feeds (array) are required.", 400, httpstatustext.FAIL));
    }

    // استرجاع سجل العلف المصنع الحالي
    const existingFodder = await Fodder.findById(fodderId).session(session);
    if (!existingFodder) {
      await session.abortTransaction();
      session.endSession();
      return next(AppError.create(`Fodder with ID "${fodderId}" not found.`, 404, httpstatustext.FAIL));
    }

    let totalQuantity = 0;
    let totalPrice = 0;
    const updatedComponents = [];

    // معالجة كل علف في مصفوفة feeds
    for (const feedItem of feeds) {
      const { feedId, quantity: newQuantity } = feedItem;

      // التحقق من وجود feedId و newQuantity
      if (!feedId || !newQuantity || isNaN(newQuantity) || newQuantity <= 0) {
        await session.abortTransaction();
        session.endSession();
        return next(AppError.create("Each feed must have a valid feedId and quantity.", 400, httpstatustext.FAIL));
      }

      // البحث عن العلف في قاعدة البيانات
      const feed = await Feed.findById(feedId).session(session);
      if (!feed) {
        await session.abortTransaction();
        session.endSession();
        return next(AppError.create(`Feed with ID "${feedId}" not found.`, 404, httpstatustext.FAIL));
      }

      // التحقق من صلاحية المستخدم
      if (feed.owner.toString() !== userId.toString()) {
        await session.abortTransaction();
        session.endSession();
        return next(AppError.create("You are not authorized to use this feed.", 403, httpstatustext.FAIL));
      }

      // البحث عن العلف القديم في سجل العلف المصنع
      const oldFeedComponent = existingFodder.components.find((component) => component.feedId.toString() === feedId);
      const oldQuantity = oldFeedComponent ? oldFeedComponent.quantity : 0;

      // حساب الفرق في الكمية
      const quantityDifference = newQuantity - oldQuantity;

      // إذا كانت الكمية الجديدة أكبر
      if (quantityDifference > 0) {
        if (feed.quantity < quantityDifference) {
          await session.abortTransaction();
          session.endSession();
          return next(AppError.create(`Not enough stock for feed "${feed.name}". Available: ${feed.quantity}, Required: ${quantityDifference}.`, 400, httpstatustext.FAIL));
        }
        feed.quantity -= quantityDifference; // خصم الفرق من المخزون
      } else if (quantityDifference < 0) {
        // إذا كانت الكمية الجديدة أقل
        feed.quantity += Math.abs(quantityDifference); // إعادة الفرق إلى المخزون
      }

      await feed.save({ session });

      // تحديث الكمية في سجل العلف المصنع
      updatedComponents.push({ feedId: feed._id, quantity: newQuantity });
      totalQuantity += newQuantity;
      totalPrice += feed.price * newQuantity;
    }

    // تحديث سجل العلف المصنع
    existingFodder.name = name;
    existingFodder.components = updatedComponents;
    existingFodder.totalQuantity = totalQuantity;
    existingFodder.totalPrice = totalPrice;
    await existingFodder.save({ session });

    // إتمام المعاملة
    await session.commitTransaction();
    session.endSession();

    // إرسال الاستجابة
    res.status(200).json({
      status: httpstatustext.SUCCESS,
      message: "Fodder updated successfully.",
      data: existingFodder,
    });
  } catch (error) {
    // التراجع عن المعاملة في حالة الخطأ
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating fodder:", error);
    next(error);
  }
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
