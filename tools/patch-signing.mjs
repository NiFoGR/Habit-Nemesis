// Points the generated Android project at the repo's committed signing key.
//
// Relying on ~/.android/debug.keystore does not work: Gradle resolves that
// through ANDROID_USER_HOME, which CI runners set for themselves, so a file
// copied to the literal path is simply not found and the Android plugin
// silently generates a fresh key instead. A fresh key means a new signature,
// which means Android refuses the update and the only way in is an uninstall
// that wipes every session, measurement and photo.
//
// Declaring the config in the build file removes the guesswork: there is one
// keystore, its path is explicit, and the build fails loudly if it is missing.

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

// `android { }` is an extension, so configuring it a second time is additive
// and does not have to be spliced into the block Capacitor generated.
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
