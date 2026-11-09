pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral() // also Meta DAT (com.meta.wearable), no token needed since Sept 2026
        // Rokid CXR-L lives only on Rokid's own Maven. Restrict it to Rokid's group so no other artifact
        // can be served from there.
        exclusiveContent {
            forRepository { maven("https://maven.rokid.com/repository/maven-public/") }
            filter { includeGroup("com.rokid.cxr") }
        }
        // Vuzix Ultralite is published through JitPack under its own group.
        exclusiveContent {
            forRepository { maven("https://jitpack.io") }
            filter { includeGroup("com.vuzix") }
        }
    }
}

rootProject.name = "live-captions"
include(":app")
