plugins {
    id("com.android.application")
}

android {
    namespace = "dev.smartglasses.livecaptions"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.smartglasses.livecaptions"
        // 31 (Android 12): the Vuzix Ultralite README asks for Android 12+ (its AAR declares 30), Rokid CXR-L needs 28,
        // Meta DAT 29. Android 12 is also where a Presentation gets its own window context, so it can live outside
        // an Activity, and where BLUETOOTH_CONNECT became a runtime permission.
        minSdk = 31
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    flavorDimensions += "vendor"
    productFlavors {
        // Rokid, Vuzix, USB-C display, notification and voice targets. Builds with public repositories only.
        create("standard") {
            dimension = "vendor"
            isDefault = true
        }
        // Adds Meta Ray-Ban Display through the Device Access Toolkit (DAT). See README.md "Meta flavor".
        create("meta") {
            dimension = "vendor"
            applicationIdSuffix = ".meta"
            // "0" = Developer Mode in the Meta AI app. Production values come from the Wearables Developer Center.
            manifestPlaceholders["mwdat_application_id"] = providers.gradleProperty("mwdatApplicationId").getOrElse("0")
            manifestPlaceholders["mwdat_client_token"] = providers.gradleProperty("mwdatClientToken").getOrElse("0")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // WebSocket client for the caption server. 4.x on purpose: Meta DAT 1.0.1 is built against OkHttp 4.10.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Rung 1 vendor SDKs. Pin exact versions: Rokid's 1.2.X-SNAPSHOT needs a newer Hi Rokid app, and JitPack only
    // knows the Vuzix tag "1.9" (not "1.9.0").
    implementation("com.rokid.cxr:client-l:1.1.2")
    implementation("com.vuzix:ultralite-sdk-android:1.9")

    "metaImplementation"("com.meta.wearable:mwdat-core:1.0.1")
    "metaImplementation"("com.meta.wearable:mwdat-display:1.0.1")

    testImplementation("junit:junit:4.13.2")
}
