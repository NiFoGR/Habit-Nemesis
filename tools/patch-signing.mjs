// Points the generated Android project at the committed signing key.
//
// ~/.android/debug.keystore does not work: Gradle resolves it through
// ANDROID_USER_HOME, which CI sets for itself, so the plugin silently generates
// a fresh key. A fresh key means Android refuses the update, and the only way
// in is an uninstall that wipes everything.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const GRADLE = 'android/app/build.gradle';
const KEYSTORE = 'signing/nifo-debug.keystore';

if (!existsSync(KEYSTORE)) {
  console.error(`patch-signing: ${KEYSTORE} is missing; refusing to build an APK with an unknown key.`);
  process.exit(1);
}
if (!existsSync(GRADLE)) {
  console.error(`patch-signing: ${GRADLE} not found. Run "npx cap add android" first.`);
  process.exit(1);
}

const MARKER = 'nifo-fixed-signing';
let gradle = readFileSync(GRADLE, 'utf8');
if (gradle.includes(MARKER)) {
  console.log('patch-signing: already applied.');
  process.exit(0);
}

// `android { }` is an extension, so a second block is additive.
gradle += `
// ${MARKER}: every NiFo build is signed with the same committed key so that
// updates install over the top instead of forcing a data-losing reinstall.
android {
    signingConfigs {
        debug {
            storeFile rootProject.file('../${KEYSTORE}')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
    }
}
`;

writeFileSync(GRADLE, gradle);
console.log(`patch-signing: ${GRADLE} now signs with ${KEYSTORE}`);
