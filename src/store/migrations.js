/**
 * Data schema migration system for the CarbonLens store.
 * Applies sequential migrations to evolve persisted data between versions.
 *
 * Each migration function transforms data from version N-1 to version N.
 * Migrations are applied in order and must be idempotent-safe (handle
 * already-migrated data without errors).
 * @module migrations
 */

/**
 * Current schema version number.
 * Increment this when adding a new migration.
 * @type {number}
 */
export const CURRENT_VERSION = 1;

/**
 * Ensures a value is an array, returning an empty array if not.
 * @param {*} value - The value to check.
 * @returns {Array} The value if it's an array, or an empty array.
 * @private
 */
function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Ensures a value is a plain object, returning an empty object if not.
 * @param {*} value - The value to check.
 * @returns {object} The value if it's a plain object, or an empty object.
 * @private
 */
function ensureObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

/**
 * Map of version numbers to migration functions.
 * Each function receives the data object and returns the migrated data.
 * @type {Map<number, function(object): object>}
 */
export const migrations = new Map();

/**
 * Migration from v0 (unversioned / initial) to v1.
 *
 * Ensures all required top-level keys exist with correct types:
 * - activities: Array
 * - goals: Array
 * - achievements: Array
 * - profile: Object with name, country, dietType, theme
 *
 * Adds schemaVersion field. Normalizes activity entries to include
 * required fields (id, category, type, amount, date).
 * @param {object} data - The unversioned data to migrate.
 * @returns {object} Data conforming to v1 schema.
 */
migrations.set(1, (data) => {
  const migrated = { ...data };

  // Ensure top-level arrays exist
  migrated.activities = ensureArray(migrated.activities);
  migrated.goals = ensureArray(migrated.goals);
  migrated.achievements = ensureArray(migrated.achievements);

  // Ensure profile exists with all fields
  const profile = ensureObject(migrated.profile);
  migrated.profile = {
    name: typeof profile.name === 'string' ? profile.name : '',
    country: typeof profile.country === 'string' ? profile.country : 'us',
    dietType: typeof profile.dietType === 'string' ? profile.dietType : 'average',
    theme: typeof profile.theme === 'string' ? profile.theme : 'dark',
  };

  // Normalize activities: ensure each has required fields
  migrated.activities = migrated.activities.map((activity) => {
    const a = ensureObject(activity);
    return {
      id: typeof a.id === 'string' ? a.id : `migrated_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      category: typeof a.category === 'string' ? a.category : 'other',
      type: typeof a.type === 'string' ? a.type : 'unknown',
      amount: typeof a.amount === 'number' && Number.isFinite(a.amount) ? a.amount : 0,
      unit: typeof a.unit === 'string' ? a.unit : '',
      co2: typeof a.co2 === 'number' && Number.isFinite(a.co2) ? a.co2 : 0,
      date: typeof a.date === 'string' ? a.date : new Date().toISOString().slice(0, 10),
      notes: typeof a.notes === 'string' ? a.notes : '',
      ...a, // Preserve any extra fields the user may have added
    };
  });

  // Normalize goals
  migrated.goals = migrated.goals.map((goal) => {
    const g = ensureObject(goal);
    return {
      id: typeof g.id === 'string' ? g.id : `goal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: typeof g.name === 'string' ? g.name : 'Unnamed Goal',
      targetCO2: typeof g.targetCO2 === 'number' && Number.isFinite(g.targetCO2) ? g.targetCO2 : 0,
      period: typeof g.period === 'string' ? g.period : 'monthly',
      createdAt: typeof g.createdAt === 'string' ? g.createdAt : new Date().toISOString(),
      ...g,
    };
  });

  // Set schema version
  migrated.schemaVersion = 1;

  return migrated;
});

/**
 * Applies sequential migrations to data from one version to another.
 *
 * Migrations are applied in order: fromVersion+1, fromVersion+2, ..., toVersion.
 * If fromVersion >= toVersion, the data is returned unchanged.
 * @param {object} data - The data to migrate.
 * @param {number} fromVersion - The current version of the data (0 if unversioned).
 * @param {number} [toVersion] - The target version.
 * @returns {object} The migrated data at the target version.
 * @throws {TypeError} If data is not an object.
 * @throws {RangeError} If toVersion exceeds the highest available migration.
 * @example
 * // Migrate unversioned data to current
 * const migrated = migrateData(oldData, 0);
 * @example
 * // Migrate from v1 to v2 (when v2 exists)
 * const migrated = migrateData(data, 1, 2);
 */
export function migrateData(data, fromVersion, toVersion = CURRENT_VERSION) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('[Migrations] data must be a plain object');
  }

  if (typeof fromVersion !== 'number' || !Number.isInteger(fromVersion) || fromVersion < 0) {
    throw new TypeError('[Migrations] fromVersion must be a non-negative integer');
  }

  if (typeof toVersion !== 'number' || !Number.isInteger(toVersion) || toVersion < 0) {
    throw new TypeError('[Migrations] toVersion must be a non-negative integer');
  }

  if (fromVersion >= toVersion) {
    return data;
  }

  // Check that all required migrations exist
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    if (!migrations.has(version)) {
      throw new RangeError(
        `[Migrations] No migration found for version ${version}. ` +
        `Available: ${[...migrations.keys()].join(', ')}`
      );
    }
  }

  let migrated = { ...data };

  for (let version = fromVersion + 1; version <= toVersion; version++) {
    const migrationFn = migrations.get(version);
    try {
      migrated = migrationFn(migrated);
      console.info(`[Migrations] Successfully migrated to v${version}`);
    } catch (error) {
      console.error(`[Migrations] Failed to migrate to v${version}:`, error);
      throw new Error(`Migration to v${version} failed: ${error.message}`);
    }
  }

  return migrated;
}

/**
 * Detects the schema version of the given data.
 * Returns 0 if no version is found (unversioned data).
 * @param {object} data - The data to inspect.
 * @returns {number} The detected schema version.
 */
export function detectVersion(data) {
  if (data === null || typeof data !== 'object') {
    return 0;
  }

  const version = data.schemaVersion;

  if (typeof version === 'number' && Number.isInteger(version) && version > 0) {
    return version;
  }

  return 0;
}
