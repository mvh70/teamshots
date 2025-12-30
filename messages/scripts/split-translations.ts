import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Messages {
  [key: string]: any;
}

/**
 * Split monolithic translation files into domain-specific and shared files
 *
 * Target structure:
 * - messages/en/shared.json - All shared namespaces
 * - messages/en/teamshotspro.json - TeamShots landing content
 * - messages/en/photoshotspro.json - PhotoShots landing content
 */
async function splitTranslations(locale: 'en' | 'es') {
  console.log(`\n📦 Processing ${locale} translations...`);

  const sourcePath = path.join(__dirname, `../${locale}.json`);
  const source = JSON.parse(await fs.readFile(sourcePath, 'utf-8')) as Messages;

  // Create directory structure
  const baseDir = path.join(__dirname, `../${locale}`);
  await fs.mkdir(baseDir, { recursive: true });

  // Extract domain-specific landing content
  const teamshotsLanding = source.landing?.teamshotspro;
  const photoshotsLanding = source.landing?.photoshotspro;

  if (!teamshotsLanding || !photoshotsLanding) {
    throw new Error(`Missing landing content in ${locale}.json`);
  }

  // Create domain files with nested structure
  const teamshotsMessages = {
    landing: {
      teamshotspro: teamshotsLanding
    }
  };

  const photoshotsMessages = {
    landing: {
      photoshotspro: photoshotsLanding
    }
  };

  // Create shared messages (everything except domain-specific landing)
  const sharedMessages: Messages = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === 'landing') {
      // For landing, exclude domain-specific content but keep any other landing keys
      const landingCopy: Messages = {};
      for (const [landingKey, landingValue] of Object.entries(source.landing)) {
        if (landingKey !== 'teamshotspro' && landingKey !== 'photoshotspro') {
          landingCopy[landingKey] = landingValue;
        }
      }
      // Only add landing to shared if there's non-domain content
      if (Object.keys(landingCopy).length > 0) {
        sharedMessages.landing = landingCopy;
      }
    } else {
      sharedMessages[key] = value;
    }
  }

  // Write files
  await fs.writeFile(
    path.join(baseDir, 'shared.json'),
    JSON.stringify(sharedMessages, null, 2) + '\n'
  );
  console.log(`  ✓ Created ${locale}/shared.json`);

  await fs.writeFile(
    path.join(baseDir, 'teamshotspro.json'),
    JSON.stringify(teamshotsMessages, null, 2) + '\n'
  );
  console.log(`  ✓ Created ${locale}/teamshotspro.json`);

  await fs.writeFile(
    path.join(baseDir, 'photoshotspro.json'),
    JSON.stringify(photoshotsMessages, null, 2) + '\n'
  );
  console.log(`  ✓ Created ${locale}/photoshotspro.json`);

  // Report sizes
  const sharedSize = (JSON.stringify(sharedMessages).length / 1024).toFixed(1);
  const teamshotsSize = (JSON.stringify(teamshotsMessages).length / 1024).toFixed(1);
  const photoshotsSize = (JSON.stringify(photoshotsMessages).length / 1024).toFixed(1);

  console.log(`\n  📊 File sizes:`);
  console.log(`     shared.json: ${sharedSize} KB`);
  console.log(`     teamshotspro.json: ${teamshotsSize} KB`);
  console.log(`     photoshotspro.json: ${photoshotsSize} KB`);
}

async function main() {
  console.log('🚀 Starting translation file split...\n');

  try {
    await splitTranslations('en');
    await splitTranslations('es');

    console.log('\n✅ All translations split successfully!\n');
    console.log('📝 Next steps:');
    console.log('  1. Review generated files in messages/{en,es}/');
    console.log('  2. Update src/types/i18n.d.ts for type safety');
    console.log('  3. Update src/i18n/request.ts with new loading logic');
    console.log('  4. Update src/app/auth/layout.tsx static imports');
    console.log('  5. Update src/lib/translations.ts imports');
    console.log('  6. Test build: npm run build');
    console.log('  7. Delete old messages/en.json and messages/es.json when verified\n');
  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    process.exit(1);
  }
}

main();
