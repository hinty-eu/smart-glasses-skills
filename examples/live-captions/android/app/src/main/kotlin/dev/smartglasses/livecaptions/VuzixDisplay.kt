package dev.smartglasses.livecaptions

import android.os.Handler
import android.os.Looper
import androidx.lifecycle.Observer
import com.vuzix.ultralite.EventListener
import com.vuzix.ultralite.Layout
import com.vuzix.ultralite.UltraliteSDK

/**
 * Rung 1: Vuzix Z100 through the Vuzix Ultralite SDK (com.vuzix:ultralite-sdk-android:1.9, JitPack).
 *
 * The Vuzix Connect app owns the Bluetooth link; the SDK binds to it in the background. To draw, an app takes
 * "control" of the display (the last app to ask wins), sets a layout, sends text, and releases control when done,
 * or the last caption can stay on the glasses. Taps anywhere on the frame: 1 = repeat, 2 = skip. maxNumTaps is 2
 * because every extra tap count makes the glasses wait longer before reporting a tap; hide stays on the phone, and the
 * 30 s display timeout blanks the glasses by itself.
 * LiveData and listener callbacks run on the main thread.
 */
class VuzixDisplay(private val host: DisplayHost) : GlassesDisplay {
    override val id = "vuzix"

    // Estimate: MentraOS measured about 42 Latin characters per line in this text layout (community, unverified by
    // us); 36 leaves 15 percent slack. Three lines stay glanceable in front of one eye.
    override val budget = LineBudget(lines = 3, cols = 36, minIntervalMs = 300)

    private val main = Handler(Looper.getMainLooper())
    private val sdk: UltraliteSDK by lazy { UltraliteSDK.get(host.activity.applicationContext) }
    private var wanted = false
    private var observing = false
    private var hasControl = false
    private var lines: List<String> = emptyList()
    private var lastTapAt = 0L

    private val connectedObserver = Observer<Boolean> { connected ->
        if (!wanted) return@Observer
        if (connected == true) {
            if (!sdk.isControlledByMe) sdk.requestControl() // the grant arrives in controlObserver
        } else {
            host.onStatus(id, "glasses not connected to Vuzix Connect")
        }
    }

    private val controlObserver = Observer<Boolean> { mine ->
        val had = hasControl
        hasControl = mine == true
        if (hasControl) {
            // Text layout at the bottom, display sleeps after 30 s without a draw, status bar hidden, 1 and 2 taps
            sdk.setLayout(Layout.TEXT_BOTTOM_LEFT_ALIGN, 30, true, false, 2)
            host.onStatus(id, "connected")
            draw()
        } else if (had && wanted) {
            // Another Z100 app took the display. Do not request it back in a loop; let the user press Connect.
            host.onStatus(id, "another app took the display")
        }
    }

    private val taps = object : EventListener {
        override fun onTap(tapCount: Int) {
            // Adjusting the glasses or wiping the forehead can register a tap, and taps may be reported twice: debounce
            val now = System.currentTimeMillis()
            if (now - lastTapAt < 300) return
            lastTapAt = now
            when (tapCount) {
                1 -> host.onAction(InputAction.REPEAT)
                2 -> host.onAction(InputAction.SKIP)
            }
        }
    }

    override fun connect() {
        wanted = true
        if (!observing) {
            observing = true
            sdk.connected.observeForever(connectedObserver)
            sdk.controlledByMe.observeForever(controlObserver)
            sdk.addEventListener(taps)
        }
        host.onStatus(id, "looking for Vuzix Connect")
        waitForConnect(0)
    }

    /** The SDK binds to Vuzix Connect asynchronously (it retries every few seconds), so give it a moment. */
    private fun waitForConnect(tries: Int) {
        if (!wanted) return
        when {
            sdk.isAvailable -> when {
                !sdk.isLinked -> host.onStatus(id, "pair the glasses in Vuzix Connect first")
                !sdk.isConnected -> host.onStatus(id, "glasses not connected to Vuzix Connect")
                sdk.isControlledByMe -> controlObserver.onChanged(true)
                else -> if (!sdk.requestControl()) host.onStatus(id, "control refused")
            }
            tries < 14 -> main.postDelayed({ waitForConnect(tries + 1) }, 500)
            else -> host.onStatus(id, "install Vuzix Connect (com.vuzix.connect)")
        }
    }

    override fun show(lines: List<String>) {
        this.lines = lines
        draw()
    }

    private fun draw() {
        if (!hasControl) return
        sdk.screenOn() // wakes the display if the 30 s timeout put it to sleep
        // unverified: line breaks in sendText come from community code, the javadoc does not mention them.
        sdk.sendText(lines.joinToString("\n").ifEmpty { " " })
    }

    override fun clear() {
        lines = emptyList()
        if (!hasControl) return
        sdk.sendText(" ")
        sdk.screenOff() // saves battery; the next draw turns it on
    }

    override fun disconnect() {
        wanted = false
        lines = emptyList()
        if (!observing) return
        sdk.removeEventListener(taps)
        if (hasControl) sdk.releaseControl() // back to notification mode, else the last caption may stay up
        hasControl = false
        sdk.connected.removeObserver(connectedObserver)
        sdk.controlledByMe.removeObserver(controlObserver)
        observing = false
        host.onStatus(id, "disconnected")
    }
}
