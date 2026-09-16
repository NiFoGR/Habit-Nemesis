// Turns R8 on for the release build, with the keep rules that stop it breaking
// the app.
//
// Play scores an unminified bundle "Low" on app optimisation, and it is right
// to: R8 shrinks, optimises and renames, and without it every class ships whole
// under its own name.
//
// The danger is that R8 fails at runtime rather than at build time. Capacitor
// finds plugins and their permission requirements by reading annotations
// reflectively, and the WebView bridge is reached by name from JavaScript, so a
// build that compiles can still die on the first plugin call. Every rule below
// exists because something looks that class or member up by a name R8 would
// otherwise rewrite.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const GRADLE = 'android/app/build.gradle';
const RULES = 'android/app/proguard-rules.pro';

const KEEP = `# Written by tools/patch-r8.mjs. Edit that, not this: android/ is regenerated
# from www/ on every build and anything hand-edited here is thrown away.

# ---- the Capacitor bridge ----
# JavaScript calls these by name. Renaming one is a method not found at runtime.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Every plugin is found by class and called by annotated method name.
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# ---- the annotations themselves ----
# R8 full mode drops annotation types nothing references statically, then folds
# getPluginAnnotation() to null, and the first permission check becomes a
# thrown null. ionic-team/capacitor#8589: AGP 8.13.0 with R8 8.13.6, which is
# the pairing this project builds on.
-keepattributes *Annotation*, RuntimeVisibleAnnotations, AnnotationDefault
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }
-keep @interface com.getcapacitor.NativePlugin { *; }
-keep class com.getcapacitor.annotation.** { *; }
-keepclassmembers class com.getcapacitor.PluginHandle {
    java.lang.Class pluginClass;
    com.getcapacitor.annotation.CapacitorPlugin pluginAnnotation;
    com.getcapacitor.NativePlugin legacyPluginAnnotation;
    com.getcapacitor.annotation.CapacitorPlugin getPluginAnnotation();
    com.getcapacitor.NativePlugin getLegacyPluginAnnotation();
    <init>(...);
}

# ---- this app's own native code ----
# The widget providers and the receiver are named as strings in the manifest,
# and the plugins are found by annotation. AGP keeps manifest components on its
# own; these are written out so a rename in Java that misses the manifest is a
# build failure rather than a widget that silently stops updating.
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
gradle = gradle
  .replace(/minifyEnabled false/, 'minifyEnabled true\n            shrinkResources true')
  .replace(/getDefaultProguardFile\('proguard-android\.txt'\)/, "getDefaultProguardFile('proguard-android-optimize.txt')");

if (gradle === before) {
  console.error('Neither minifyEnabled nor the default ProGuard file was found. Capacitor changed its template.');
  process.exit(1);
}
writeFileSync(GRADLE, gradle);

// Checked rather than assumed: a silent no-op here ships an unminified bundle
// and Play scores it exactly as it did before.
const after = readFileSync(GRADLE, 'utf8');
for (const want of ['minifyEnabled true', 'shrinkResources true', 'proguard-android-optimize.txt']) {
  if (!after.includes(want)) {
    console.error(`"${want}" did not land in ${GRADLE}. Build left as it was.`);
    process.exit(1);
  }
}
if (!readFileSync(RULES, 'utf8').includes('com.getcapacitor.Plugin')) {
  console.error(`The keep rules did not land in ${RULES}.`);
  process.exit(1);
}

console.log('patch-r8: minify and resource shrinking on, keep rules written');
