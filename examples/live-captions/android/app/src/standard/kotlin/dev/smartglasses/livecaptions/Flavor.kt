package dev.smartglasses.livecaptions

import android.app.Activity
import android.content.Intent

/** Standard flavor: no Meta Device Access Toolkit in this build (see the `meta` flavor). */
object Flavor {
    fun metaDisplay(host: DisplayHost): GlassesDisplay? = null

    fun onCreate(activity: Activity) = Unit

    fun onIntent(activity: Activity, intent: Intent) = Unit
}
