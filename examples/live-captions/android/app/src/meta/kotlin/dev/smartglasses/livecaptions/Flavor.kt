package dev.smartglasses.livecaptions

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.types.WearablesError

/** Meta flavor: offers [MetaDisplay] and routes Meta AI's registration intents to the toolkit. */
object Flavor {
    fun metaDisplay(host: DisplayHost): GlassesDisplay = MetaDisplay(host)

    fun onCreate(activity: Activity) = onIntent(activity, activity.intent)

    /** Meta AI can start a registration that comes back as an intent: called from onCreate and onNewIntent. */
    fun onIntent(activity: Activity, intent: Intent) = MetaDat.handleIntent(activity, intent)
}

/**
 * Initializes the toolkit lazily. Do not call Wearables.initialize before BLUETOOTH_CONNECT and BLUETOOTH_SCAN are
 * granted: developers report the glasses link then stays DISCONNECTED for the life of the process
 * (github.com/meta/meta-wearables-dat-android/issues/177, 2026-09).
 */
object MetaDat {
    private var initialized = false
    private var pending: Intent? = null

    fun initialize(activity: Activity) {
        if (initialized) return
        Wearables.initialize(activity.applicationContext).onFailure { error, _ ->
            if (error != WearablesError.ALREADY_INITIALIZED) Log.w("LiveCaptions.Meta", "DAT init failed: ${error.description}")
        }
        initialized = true
        pending?.let { handleIntent(activity, it) }
        pending = null
    }

    fun handleIntent(activity: Activity, intent: Intent) {
        if (!initialized) {
            pending = intent // handled once the permissions are granted and the toolkit is up
            return
        }
        // Returns false for intents that are not a Meta AI registration
        Wearables.handleIntent(intent) { request -> request.continueRegistration(activity) }
    }
}
