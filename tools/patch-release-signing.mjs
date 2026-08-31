// Points the generated Android project at the release key, for store builds.
//
// The key never touches the repo. It arrives base64 in RELEASE_KEYSTORE_B64
// with its passwords beside it, which is how a GitHub secret hands over a
// binary. Every value is required and checked: a release build that silently
// fell back to the public debug key would ship an APK anyone can re-sign.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const GRADLE = 'android/app/build.gradle';
const OUT = 'android/release.keystore';

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`patch-release-signing: ${name} is not set. A release build needs all four of`);
    console.error('  RELEASE_KEYSTORE_B64  RELEASE_KEYSTORE_PASSWORD  RELEASE_KEY_ALIAS  RELEASE_KEY_PASSWORD');
    process.exit(1);
  }
  return v;
};

const b64 = need('RELEASE_KEYSTORE_B64');
const storePassword = need('RELEASE_KEYSTORE_PASSWORD');
const keyAlias = need('RELEASE_KEY_ALIAS');
const keyPassword = need('RELEASE_KEY_PASSWORD');

if (!existsSync(GRADLE)) {
  console.error(`patch-release-signing: ${GRADLE} not found. Run "npx cap add android" first.`);
  process.exit(1);
}

// The debug key must never sign a release. Its alias is the tell.
if (keyAlias === 'androiddebugkey') {
  console.error('patch-release-signing: refusing the debug alias for a release build.');
  process.exit(1);
}

// A debuggable WebView in a shipped build is an open door. Capacitor turns it
// off for release on its own; this only catches a config that forces it back on.
const cap = readFileSync('capacitor.config.json', 'utf8');
if (/"webContentsDebuggingEnabled"\s*:\s*true/.test(cap)) {
  console.error('patch-release-signing: capacitor.config.json forces WebView debugging on. Remove it.');
  process.exit(1);
}

mkdirSync('android', { recursive: true });
const keystore = Buffer.from(b64, 'base64');

// PKCS12 keeps one password for the store and the key inside it: keytool says
// so and ignores a second one. Gradle then fails on the key password with an
// error naming neither. JKS is the only format with two. A JKS file starts
// FE ED FE ED; anything else here is PKCS12.
const isJks = keystore[0] === 0xfe && keystore[1] === 0xed;
if (!isJks && storePassword !== keyPassword) {
  console.error('patch-release-signing: this keystore is PKCS12, which has one password.');
  console.error('  Set RELEASE_KEY_PASSWORD to the same value as RELEASE_KEYSTORE_PASSWORD.');
  process.exit(1);
}

writeFileSync(OUT, keystore);

const MARKER = 'release-signing';
let gradle = readFileSync(GRADLE, 'utf8');
if (gradle.includes(MARKER)) {
  console.log('patch-release-signing: already applied.');
  process.exit(0);
}

// Passwords come through Gradle properties rather than being written into the
// build file, so a leaked build directory does not leak them.
gradle += `
// ${MARKER}: store builds sign with the release key from the environment.
android {
    signingConfigs {
        release {
            storeFile rootProject.file('release.keystore')
            storePassword System.getenv('RELEASE_KEYSTORE_PASSWORD')
            keyAlias System.getenv('RELEASE_KEY_ALIAS')
            keyPassword System.getenv('RELEASE_KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`;

writeFileSync(GRADLE, gradle);
console.log(`patch-release-signing: ${GRADLE} signs release with alias '${keyAlias}'`);
