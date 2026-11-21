import { setDriver, hasDriver } from '@/db/driver';
import { openExpoDriver } from '@/db/expoDriver';
import { runMigrations } from '@/db/migrations';
import { seedExerciseLibrary } from '@/db/repositories/fitnessRepo';
import { loadPreferences, type Preferences } from '@/store/preferences';

let opening: Promise<Preferences> | null = null;

/**
 * Opens the database, applies migrations, seeds static data and loads
 * preferences. Idempotent; runs behind the splash screen.
 */
export function bootstrapApp(): Promise<Preferences> {
  if (!opening) {
    opening = (async () => {
      if (!hasDriver()) {
        const driver = await openExpoDriver();
        await runMigrations(driver);
        setDriver(driver);
      }
      await seedExerciseLibrary();
      return loadPreferences();
    })().catch((error: unknown) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}
