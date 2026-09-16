// Turns R8 on for the release build, with the keep rules that stop it breaking
// the app.
//
// Play scores an unminified bundle "Low" on app optimisation, and it is right
// to: R8 shrinks, optimises and renames, and without it every class ships whole
// under its own name.
//
// The danger is that R8 fails at runtime rather than at build time. Capacitor
// reads the five classes in capacitor.plugins.json as strings and calls
// Class.forName on each one while the first activity is being created, so a
// rename there is a crash on launch with a green build behind it. Every rule
// below exists because something looks that class or member up by a name R8
// would otherwise rewrite, and tools/check-r8.mjs reads the mapping file
// afterwards rather than trusting that the rules matched.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const GRADLE = 'android/app/build.gradle';
const RULES = 'android/app/proguard-rules.pro';
const PROPS = 'android/gradle.properties';

const KEEP = `# Written by tools/patch-r8.mjs. Edit that, not this: android/ is regenerated
# from www/ on every build and anything hand-edited here is thrown away.

# ---- the Capacitor bridge ----
# JavaScript calls these by name. Renaming one is a method not found at runtime.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor reads its own classes, methods and annotations reflectively all the
# way through the bridge, so the whole library is kept rather than the parts
# that looked reflective. It is a few hundred classes against the app's 4,500.
-keep class com.getcapacitor.** { *; }

# Every plugin is found by class and called by annotated method name. The
# packages are named as well as the supertype: an "extends" rule matches only
# what R8 still sees as a subclass, and the plugin list is read as strings.
-keep class com.capacitorjs.plugins.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# ---- the annotations themselves ----
# R8 drops annotation types nothing references statically, then folds
# getPluginAnnotation() to null, and the first permission check becomes a
# thrown null. ionic-team/capacitor#8589.
-keepattributes *Annotation*, RuntimeVisibleAnnotations, AnnotationDefault
-keepattributes Signature, InnerClasses, EnclosingMethod
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }
-keep @interface com.getcapacitor.NativePlugin { *; }

# ---- this app's own native code ----
# The widget providers and the receiver are named as strings in the manifest,
# and the plugins are found by annotation.
-keep class com.habitnemesis.widgets.** { *; }
-keep class com.habitnemesis.systemui.** { *; }

# ---- what a crash report needs ----
# Renaming is the point, but a stack trace with no line numbers is unreadable.
# The mapping file goes to Play with the bundle and turns these back.
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
`;

if (!existsSync(GRADLE)) {
  console.error(`${GRADLE} not found. Run \`npx cap add android\` first.`);
  process.exit(1);
}

writeFileSync(RULES, KEEP);

// AGP 8 defaults R8 to full mode, which is the aggressive one: it ignores a
// library's own consumer rules, drops annotations nothing references
// statically, and merges classes horizontally. All three break code that finds
// things by name, and Capacitor finds everything by name. Minification and
// renaming are unaffected, which is what Play is scoring.
const props = readFileSync(PROPS, 'utf8');
if (!props.includes('android.enableR8.fullMode')) {
  writeFileSync(PROPS, `${props.trimEnd()}\n\n# R8's aggressive mode breaks Capacitor's reflection. See tools/patch-r8.mjs.\nandroid.enableR8.fullMode=false\n`);
}

let gradle = readFileSync(GRADLE, 'utf8');

// android/ is regenerated on every build, so this normally sees a fresh file.
// Run by hand twice it must not read its own work as a template that changed.
if (gradle.includes('minifyEnabled true')) {
  console.log('patch-r8: already applied, keep rules rewritten');
  process.exit(0);
}

const before = gradle;

// proguard-android-optimize.txt is the same defaults with the optimiser left
// on. The plain file turns it off, which is most of what Play is measuring.
//
// shrinkResources stays off. The dex is nearly all of a WebView app's size, so
// it buys little, and it drops resources reached only through a name.
gradle = gradle
  .replace(/minifyEnabled false/, 'minifyEnabled true')
  .replace(/getDefaultProguardFile\('proguard-android\.txt'\)/, "getDefaultProguardFile('proguard-android-optimize.txt')");

if (gradle === before) {
  console.error('Neither minifyEnabled nor the default ProGuard file was found. Capacitor changed its template.');
  process.exit(1);
}
writeFileSync(GRADLE, gradle);

// Checked rather than assumed: a silent no-op here ships an unminified bundle
// and Play scores it exactly as it did before.
const after = readFileSync(GRADLE, 'utf8');
for (const want of ['minifyEnabled true', 'proguard-android-optimize.txt']) {
  if (!after.includes(want)) {
    console.error(`"${want}" did not land in ${GRADLE}. Build left as it was.`);
    process.exit(1);
  }
}
if (!readFileSync(PROPS, 'utf8').includes('android.enableR8.fullMode=false')) {
  console.error(`R8 full mode was not turned off in ${PROPS}.`);
  process.exit(1);
}
if (!readFileSync(RULES, 'utf8').includes('com.getcapacitor.Plugin')) {
  console.error(`The keep rules did not land in ${RULES}.`);
  process.exit(1);
}

console.log('patch-r8: minify on, full mode off, keep rules written');
