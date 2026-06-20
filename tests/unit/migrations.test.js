import { describe, it, expect } from 'vitest';
import { migrateData, CURRENT_VERSION } from '../../src/store/migrations.js';

describe('migrations module', () => {
  it('returns data as is if already at current version', () => {
    const data = { schemaVersion: CURRENT_VERSION, activities: [] };
    const migrated = migrateData(data, CURRENT_VERSION);
    expect(migrated.schemaVersion).toBe(CURRENT_VERSION);
  });

  it('migrates from v0 to current version', () => {
    const oldData = {
      activities: [{ category: 'transportation', amount: 10, co2: 5 }],
      profile: { name: 'Test' }
    };
    
    const migrated = migrateData(oldData, 0);
    expect(migrated.schemaVersion).toBe(CURRENT_VERSION);
    expect(migrated.profile.theme).toBe('dark'); // added by migration
    expect(migrated.activities[0].id).toBeDefined(); // added by migration
  });

  it('handles corrupted input gracefully', () => {
    expect(() => migrateData(null, 0)).toThrow();
  });
});
