// helpers/excluded.js
const Excluded = require('../Models/excluded.model');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

// helpers/excluded.js
const filterNonExcludedAnimals = async ({ userId, animals, session = null }) => {
    const animalIds = animals.map(a => a._id);
    const q = Excluded.find({ owner: userId, animalId: { $in: animalIds } }).select('animalId excludedType Date');
    if (session) q.session(session);
    const excludedDocs = await q;
  
    const excludedSet = new Set(excludedDocs.map(d => d.animalId.toString()));
    const eligible = animals.filter(a => !excludedSet.has(a._id.toString()));
    const excluded = animals.filter(a => excludedSet.has(a._id.toString()));
    return { eligible, excluded, excludedDocs };
  };
  
  const assertAnimalNotExcluded = async ({ userId, animalId, tagId, actionName = 'This action', session = null }) => {
    const q = Excluded.findOne({ owner: userId, animalId }).select('excludedType Date');
    if (session) q.session(session);
    const excluded = await q;
    if (excluded) {
      const when = excluded.Date ? ` on ${excluded.Date.toISOString().slice(0,10)}` : '';
      throw AppError.create(
        `${actionName} is not allowed: animal (${tagId}) is excluded (${excluded.excludedType})${when}.`,
        400,
        httpstatustext.FAIL
      );
    }
  };
  
  module.exports = {
    filterNonExcludedAnimals,
    assertAnimalNotExcluded,
    // alias 
    assertNotExcluded: assertAnimalNotExcluded,
  };