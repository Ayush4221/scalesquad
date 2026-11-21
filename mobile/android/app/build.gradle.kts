plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val releaseKeystorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH").orNull
val releaseStorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD").orNull

android {
    namespace = "com.example.scalesquad_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.example.scalesquad"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
        }
        create("prod") {
            dimension = "environment"
            applicationId = "com.ayushdhoot.scalesquad"
        }
    }

    signingConfigs {
        create("production") {
            if (!releaseKeystorePath.isNullOrBlank()) storeFile = file(releaseKeystorePath)
            storePassword = releaseStorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
    }

    buildTypes {
        getByName("release") {
            isDebuggable = false
            signingConfig = signingConfigs.getByName("production")
        }
    }

}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

gradle.taskGraph.whenReady {
    if (allTasks.any { it.name.contains("Release", ignoreCase = true) }) {
        if (allTasks.any { it.name.contains("DevRelease", ignoreCase = true) }) {
            throw GradleException("Release builds require the prod flavor.")
        }
        fun gitValue(vararg arguments: String): String {
            val process = ProcessBuilder(listOf("git") + arguments)
                .directory(rootProject.projectDir.parentFile.parentFile)
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start()
            val value = process.inputStream.bufferedReader().readText().trim()
            if (process.waitFor() != 0) throw GradleException("Cannot verify the release Git context.")
            return value
        }
        val branch = gitValue("branch", "--show-current")
        val env = System.getenv()
        val trustedMasterCheckout = branch.isEmpty() &&
            env["GITHUB_ACTIONS"] == "true" &&
            env["GITHUB_REF"] == "refs/heads/master" &&
            env["GITHUB_EVENT_NAME"] in listOf("push", "workflow_dispatch") &&
            !env["GITHUB_SHA"].isNullOrBlank() &&
            gitValue("rev-parse", "HEAD") == env["GITHUB_SHA"]
        if (branch != "master" && !trustedMasterCheckout) {
            throw GradleException("Android release builds are allowed only on master.")
        }
        if (listOf(releaseKeystorePath, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
                .any { it.isNullOrBlank() } || !file(releaseKeystorePath!!).isFile) {
            throw GradleException("Release signing is missing. See docs/ANDROID_RELEASE.md.")
        }
    }
}
