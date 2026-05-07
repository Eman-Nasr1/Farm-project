const mongoose = require('mongoose');
const Animal = require('../Models/animal.model');
const Weight = require('../Models/weight.model');
const Vaccine = require('../Models/vaccine.model');
const SyncTombstone = require('../Models/syncTombstone.model');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

const COLLECTIONS = {
  animals: Animal,
  weights: Weight,
  vaccines: Vaccine,
};

const DEFAULT_COLLECTIONS = Object.keys(COLLECTIONS);
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

const parseCollections = (collectionsQuery) => {
  if (!collectionsQuery) return DEFAULT_COLLECTIONS;

  const values = collectionsQuery
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const uniqueValues = [...new Set(values)];
  const invalid = uniqueValues.filter((name) => !COLLECTIONS[name]);
  if (invalid.length) {
    throw AppError.create(
      `Invalid collections: ${invalid.join(', ')}`,
      400,
      httpstatustext.FAIL
    );
  }

  return uniqueValues.length ? uniqueValues : DEFAULT_COLLECTIONS;
};

const parseSinceDate = (since) => {
  if (!since) return null;
  const parsed = new Date(since);
  if (Number.isNaN(parsed.getTime())) {
    throw AppError.create('Invalid "since" date', 400, httpstatustext.FAIL);
  }
  return parsed;
};

const sanitizeRecordForWrite = (record, ownerId) => {
  const payload = { ...(record || {}) };
  delete payload.__v;
  payload.owner = ownerId;
  return payload;
};

const getModelFilter = (model, ownerId, sinceDate) => {
  const filter = { owner: ownerId };
  if (!sinceDate) return filter;

  const orFilters = [{ createdAt: { $gte: sinceDate } }];
  if (model.schema.path('updatedAt')) {
    orFilters.push({ updatedAt: { $gte: sinceDate } });
  }

  filter.$or = orFilters;
  return filter;
};

const getChanges = asyncwrapper(async (req, res, next) => {
  try {
    const ownerId = req.user?.tenantId || req.user?.id;
    if (!ownerId) {
      return next(AppError.create('User not authenticated', 401, httpstatustext.ERROR));
    }

    const collections = parseCollections(req.query.collections);
    const sinceDate = parseSinceDate(req.query.since);
    const limit = Math.min(Math.max(parseInt(req.query.limit || DEFAULT_LIMIT, 10), 1), MAX_LIMIT);

    const data = {};
    for (const collectionName of collections) {
      const model = COLLECTIONS[collectionName];
      const filter = getModelFilter(model, ownerId, sinceDate);
      const records = await model.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      data[collectionName] = records;
    }

    const deletedFilter = { owner: ownerId };
    deletedFilter.collectionName = { $in: collections };
    if (sinceDate) deletedFilter.deletedAt = { $gte: sinceDate };
    const deleted = await SyncTombstone.find(deletedFilter).sort({ deletedAt: -1 }).limit(limit).lean();

    return res.status(200).json({
      status: httpstatustext.SUCCESS,
      message: 'Sync changes fetched successfully',
      data: {
        serverTime: new Date().toISOString(),
        since: sinceDate ? sinceDate.toISOString() : null,
        collections,
        records: data,
        deleted,
      },
    });
  } catch (error) {
    return next(error);
  }
});

const processOperation = async ({ operation, ownerId, session }) => {
  const { collection, type } = operation;
  const model = COLLECTIONS[collection];
  if (!model) {
    throw AppError.create(`Unsupported collection: ${collection}`, 400, httpstatustext.FAIL);
  }

  const opType = (type || '').toLowerCase();
  const operationId = operation.operationId || null;
  const recordId = operation.recordId || operation.record?._id || null;
  const sanitized = sanitizeRecordForWrite(operation.record, ownerId);

  if (opType === 'create') {
    const created = await model.create([sanitized], { session });
    return { operationId, collection, type: opType, status: 'success', record: created[0] };
  }

  if (opType === 'update') {
    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      throw AppError.create('update operation requires a valid recordId', 400, httpstatustext.FAIL);
    }
    const updated = await model.findOneAndUpdate(
      { _id: recordId, owner: ownerId },
      { $set: sanitized },
      { new: true, runValidators: true, session }
    );
    if (!updated) {
      throw AppError.create('Record not found for update', 404, httpstatustext.FAIL);
    }
    return { operationId, collection, type: opType, status: 'success', record: updated };
  }

  if (opType === 'upsert') {
    if (recordId && mongoose.Types.ObjectId.isValid(recordId)) {
      const upserted = await model.findOneAndUpdate(
        { _id: recordId, owner: ownerId },
        { $set: sanitized, $setOnInsert: { createdAt: new Date() } },
        { new: true, runValidators: true, upsert: true, session }
      );
      return { operationId, collection, type: opType, status: 'success', record: upserted };
    }

    if (collection === 'animals' && sanitized.tagId) {
      const upsertedByTag = await model.findOneAndUpdate(
        { owner: ownerId, tagId: sanitized.tagId },
        { $set: sanitized, $setOnInsert: { createdAt: new Date() } },
        { new: true, runValidators: true, upsert: true, session }
      );
      return { operationId, collection, type: opType, status: 'success', record: upsertedByTag };
    }

    throw AppError.create(
      'upsert requires recordId or a supported natural key',
      400,
      httpstatustext.FAIL
    );
  }

  if (opType === 'delete') {
    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      throw AppError.create('delete operation requires a valid recordId', 400, httpstatustext.FAIL);
    }
    const deleted = await model.findOneAndDelete({ _id: recordId, owner: ownerId }, { session });
    if (!deleted) {
      throw AppError.create('Record not found for delete', 404, httpstatustext.FAIL);
    }

    await SyncTombstone.create([{
      owner: ownerId,
      collectionName: collection,
      recordId: deleted._id,
      deletedAt: new Date(),
    }], { session });

    return {
      operationId,
      collection,
      type: opType,
      status: 'success',
      recordId: deleted._id,
    };
  }

  throw AppError.create(`Unsupported operation type: ${type}`, 400, httpstatustext.FAIL);
};

const syncBatch = asyncwrapper(async (req, res, next) => {
  const ownerId = req.user?.tenantId || req.user?.id;
  if (!ownerId) {
    return next(AppError.create('User not authenticated', 401, httpstatustext.ERROR));
  }

  const operations = Array.isArray(req.body?.operations) ? req.body.operations : null;
  if (!operations || !operations.length) {
    return next(AppError.create('"operations" array is required', 400, httpstatustext.FAIL));
  }

  const results = [];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const operation of operations) {
        try {
          const result = await processOperation({ operation, ownerId, session });
          results.push(result);
        } catch (error) {
          results.push({
            operationId: operation.operationId || null,
            collection: operation.collection || null,
            type: operation.type || null,
            status: 'error',
            error: error.message || 'Operation failed',
          });
        }
      }
    });

    const hasErrors = results.some((item) => item.status === 'error');
    return res.status(hasErrors ? 207 : 200).json({
      status: hasErrors ? httpstatustext.FAIL : httpstatustext.SUCCESS,
      message: hasErrors ? 'Batch synced with some errors' : 'Batch synced successfully',
      data: {
        serverTime: new Date().toISOString(),
        results,
      },
    });
  } catch (error) {
    return next(error);
  } finally {
    await session.endSession();
  }
});

module.exports = {
  getChanges,
  syncBatch,
};
