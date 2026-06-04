/**
 * Animal types and fattening farm profiles.
 *
 * Fattening farms choose one profile at registration:
 * - small_ruminants: sheep + goat
 * - large_ruminants: cattle + buffalo
 * - all: all four types
 */

const ANIMAL_TYPES = Object.freeze(['sheep', 'goat', 'cattle', 'buffalo']);

const FATTENING_FARM_PROFILES = Object.freeze({
  small_ruminants: ['sheep', 'goat'],
  large_ruminants: ['cattle', 'buffalo'],
  all: ['sheep', 'goat', 'cattle', 'buffalo'],
});

const FATTENING_PROFILE_OPTIONS = [
  {
    id: 'small_ruminants',
    labelEn: 'Sheep & goat',
    labelAr: 'أغنام وماعز',
    animalTypes: FATTENING_FARM_PROFILES.small_ruminants,
  },
  {
    id: 'large_ruminants',
    labelEn: 'Cattle & buffalo',
    labelAr: 'أبقار وجاموس',
    animalTypes: FATTENING_FARM_PROFILES.large_ruminants,
  },
  {
    id: 'all',
    labelEn: 'All types',
    labelAr: 'كل الأنواع',
    animalTypes: FATTENING_FARM_PROFILES.all,
  },
];

const ANIMAL_TYPE_ALIASES = Object.freeze({
  sheep: ['sheep', 'غنم', 'اغنام', 'أغنام'],
  goat: ['goat', 'ماعز', 'معز'],
  cattle: ['cattle', 'cow', 'cows', 'بقر', 'ابقار', 'أبقار', 'بقره'],
  buffalo: ['buffalo', 'buffaloes', 'جاموس', 'جاموسه'],
});

function getTypesForProfile(profileId) {
  return FATTENING_FARM_PROFILES[profileId] ? [...FATTENING_FARM_PROFILES[profileId]] : null;
}

function isValidFatteningProfile(profileId) {
  return Boolean(profileId && FATTENING_FARM_PROFILES[profileId]);
}

function normalizeAnimalTypeInput(value) {
  if (!value) return null;
  const key = value.toString().trim().toLowerCase();
  if (ANIMAL_TYPES.includes(key)) return key;
  for (const [canonical, aliases] of Object.entries(ANIMAL_TYPE_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === key)) return canonical;
  }
  return null;
}

function getEnabledAnimalTypes(user) {
  if (!user) return ['sheep', 'goat'];
  if (Array.isArray(user.enabledAnimalTypes) && user.enabledAnimalTypes.length > 0) {
    return user.enabledAnimalTypes;
  }
  if (user.registerationType === 'fattening' && user.fatteningFarmProfile) {
    return getTypesForProfile(user.fatteningFarmProfile) || ['sheep', 'goat'];
  }
  return ['sheep', 'goat'];
}

function syncEnabledAnimalTypes(user) {
  if (user.registerationType === 'fattening' && user.fatteningFarmProfile) {
    user.enabledAnimalTypes = getTypesForProfile(user.fatteningFarmProfile);
  } else if (user.registerationType === 'breeding') {
    user.fatteningFarmProfile = undefined;
    user.enabledAnimalTypes = ['sheep', 'goat'];
  }
  return user;
}

function isAnimalTypeAllowed(user, animalType) {
  const normalized = normalizeAnimalTypeInput(animalType);
  if (!normalized || !ANIMAL_TYPES.includes(normalized)) return false;
  return getEnabledAnimalTypes(user).includes(normalized);
}

module.exports = {
  ANIMAL_TYPES,
  FATTENING_FARM_PROFILES,
  FATTENING_PROFILE_OPTIONS,
  getTypesForProfile,
  isValidFatteningProfile,
  normalizeAnimalTypeInput,
  getEnabledAnimalTypes,
  syncEnabledAnimalTypes,
  isAnimalTypeAllowed,
};
