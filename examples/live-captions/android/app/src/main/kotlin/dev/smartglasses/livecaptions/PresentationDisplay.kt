package dev.smartglasses.livecaptions

import android.app.Presentation
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.hardware.display.DeviceProductInfo
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.TypedValue
import android.view.Display
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Rung 3: USB-C display glasses (XREAL, VITURE, RayNeo Air and other DisplayPort Alt Mode glasses) as an external
 * display. No SDK and no permission: an android.app.Presentation draws our own view on the second display; without
 * it the glasses mirror the phone. Since Android 12 a Presentation has its own window context, so it is created from
 * the application context and keeps showing while the app is in the background (as long as the process lives).
 * These glasses send no input to the phone: use the phone buttons or the notification target for actions.
 */
class PresentationDisplay(private val host: DisplayHost) : GlassesDisplay {
    override val id = "external"
    // About 34 bold characters fit across 76% of a 16:9 display at 7% of its height; lines are ellipsized if not
    override val budget = LineBudget(lines = 3, cols = 34)

    private val app = host.activity.applicationContext
    private val main = Handler(Looper.getMainLooper())
    private val displays = app.getSystemService(DisplayManager::class.java)
    private var wanted = false
    private var listening = false
    private var presentation: CaptionPresentation? = null
    private var lines: List<String> = emptyList()

    private val listener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) {
            if (wanted && presentation == null) attach()
        }

        override fun onDisplayRemoved(displayId: Int) {
            // The system cancels a presentation whose display went away; look again once that has happened
            if (wanted) main.post { if (wanted && presentation?.isShowing != true) attach() }
        }

        override fun onDisplayChanged(displayId: Int) = Unit
    }

    override fun connect() {
        wanted = true
        if (!listening) displays.registerDisplayListener(listener, main)
        listening = true
        attach()
    }

    /** The first public presentation display that is not the phone screen and not a built-in screen (foldable cover). */
    private fun pick(): Display? = displays.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).firstOrNull { d ->
        d.displayId != Display.DEFAULT_DISPLAY &&
            d.isValid &&
            (d.flags and Display.FLAG_PRIVATE) == 0 &&
            // Android 16 can flag built-in displays for presentations too; null info = emulator or simulated display
            d.deviceProductInfo?.connectionToSinkType != DeviceProductInfo.CONNECTION_TO_SINK_BUILT_IN
    }

    private fun attach() {
        val d = pick() ?: run {
            dismiss()
            return host.onStatus(id, "plug in USB-C display glasses (or add a secondary display in the emulator)")
        }
        if (presentation?.isShowing == true && presentation?.display?.displayId == d.displayId) return
        dismiss()
        val p = CaptionPresentation(app, d, budget.lines)
        try {
            p.show()
        } catch (e: WindowManager.InvalidDisplayException) {
            // e.g. desktop mode already shows this app's own window on that display
            return host.onStatus(id, "display refused the presentation: ${e.message}")
        }
        presentation = p
        p.render(lines)
        host.onStatus(id, "showing on ${d.deviceProductInfo?.name ?: d.name}")
    }

    private fun dismiss() {
        presentation?.dismiss()
        presentation = null
    }

    override fun show(lines: List<String>) {
        this.lines = lines
        presentation?.render(lines)
    }

    override fun clear() = show(emptyList())

    override fun disconnect() {
        wanted = false
        if (listening) displays.unregisterDisplayListener(listener)
        listening = false
        dismiss()
        lines = emptyList()
        host.onStatus(id, "disconnected")
    }
}

/** White text on black at the bottom: black is see-through on these optics, and the middle stays free. */
private class CaptionPresentation(outer: Context, display: Display, private val rows: Int) : Presentation(outer, display) {
    private val views = mutableListOf<TextView>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setCancelable(false)
        window?.apply {
            // Never call setType() here: since Android 12 that breaks the presentation's window context
            setBackgroundDrawable(ColorDrawable(Color.BLACK))
            addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            )
        }
        // The presentation's own context carries the glasses' size and density, not the phone's
        val metrics = context.resources.displayMetrics
        val textPx = metrics.heightPixels * 0.07f
        val column = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.BOTTOM
            val padX = (metrics.widthPixels * 0.12f).toInt()
            setPadding(padX, 0, padX, (metrics.heightPixels * 0.08f).toInt())
        }
        repeat(rows) {
            val tv = TextView(context).apply {
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_PX, textPx)
                typeface = Typeface.DEFAULT_BOLD
                isSingleLine = true
                ellipsize = TextUtils.TruncateAt.END // lines arrive pre-wrapped; never let one push the others away
            }
            views += tv
            column.addView(tv)
        }
        setContentView(column)
    }

    fun render(lines: List<String>) {
        val offset = rows - lines.size // short text on the bottom rows
        views.forEachIndexed { i, tv -> tv.text = lines.getOrElse(i - offset) { "" } }
    }
}
