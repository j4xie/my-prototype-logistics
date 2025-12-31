# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Expo modules - keep all expo classes
-keep class expo.** { *; }
-keep class com.facebook.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep all Expo module classes
-keepclassmembers class * {
    @expo.modules.core.interfaces.ExpoProp *;
    @expo.modules.core.interfaces.ExpoMethod *;
}

# Don't warn about missing classes
-dontwarn expo.**
-dontwarn com.facebook.**
