package dev.smartglasses.livecaptions

import android.Manifest
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.selectors.AutoDeviceSelector
import com.meta.wearable.dat.core.session.DeviceSession
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.meta.wearable.dat.core.types.RegistrationState
import com.meta.wearable.dat.display.Display
import com.meta.wearable.dat.display.addDisplay
import com.meta.wearable.dat.display.removeDisplay
import com.meta.wearable.dat.display.types.DisplayState
import com.meta.wearable.dat.display.views.ButtonStyle
import com.meta.wearable.dat.display.views.TextStyle
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch

/**
 * Rung 1: Meta Ray-Ban Display through the Meta Wearables Device Access Toolkit (DAT) 1.0.1, `meta` flavor only.
 *
 * Order: BLUETOOTH_CONNECT + BLUETOOTH_SCAN -> Wearables.initialize -> registration in the Meta AI app (once) ->
 * a session on a display-capable device -> addDisplay once the session is STARTED -> sendContent once the display is
 * STARTED. Every sendContent replaces the whole screen. Buttons on the screen come back as onClick on the phone.
 * For anything beyond this, use Meta's own agent plugin (see the README of github.com/facebook/meta-wearables-dat-android).
 */
class MetaDisplay(private val host: DisplayHost) : GlassesDisplay {
    override val id = "meta"

    // unverified: lines and characters that fit the 600x600 display with TextStyle.BODY plus a button row.
    override val budget = LineBudget(lines = 4, cols = 26, minIntervalMs = 500)

    private val scope = MainScope()
    private val jobs = mutableListOf<Job>()
    private var session: DeviceSession? = null
    private var display: Display? = null
    private var wanted = false
    private var lines: List<String> = emptyList()

    override fun connect() {
        wanted = true
        // Both before initialize. A missing BLUETOOTH_SCAN shows up later as a silent NO_ELIGIBLE_DEVICE
        // (developer reports in the DAT Android issues, 2026-09).
        host.requestPermissions(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN) { granted ->
            if (granted) start() else host.onStatus(id, "Nearby devices (Bluetooth) permission denied")
        }
    }

    private fun start() {
        if (!wanted) return
        MetaDat.initialize(host.activity)
        if (jobs.isEmpty()) {
            jobs += scope.launch {
                Wearables.registrationState.collect { state ->
                    if (state == RegistrationState.REGISTERED && wanted && session == null) startSession()
                }
            }
            jobs += scope.launch {
                Wearables.registrationErrorStream.collect { e -> host.onStatus(id, "registration: ${e.description}") }
            }
        }
        if (Wearables.registrationState.value != RegistrationState.REGISTERED) {
            host.onStatus(id, "approve this app in Meta AI (Developer Mode must be on)")
            Wearables.startRegistration(host.activity)
        }
    }

    private fun startSession() {
        host.onStatus(id, "starting a session")
        Wearables.createSession(AutoDeviceSelector(filter = { it.isDisplayCapable() })).fold(
            onSuccess = { s ->
                session = s
                // Subscribe before start(): start() returns Unit and reports failures through errors
                jobs += scope.launch { s.errors.collect { e -> host.onStatus(id, e.description) } }
                jobs += scope.launch {
                    s.state.collect { state ->
                        when (state) {
                            DeviceSessionState.STARTED -> if (display == null) attachDisplay(s)
                            DeviceSessionState.STOPPED -> {
                                // Terminal: a stopped session cannot be restarted, create a new one on the next connect
                                session = null
                                display = null
                                host.onStatus(id, "session ended")
                            }
                            else -> Unit
                        }
                    }
                }
                s.start()
            },
            onFailure = { e, _ -> host.onStatus(id, e.description) },
        )
    }

    private fun attachDisplay(s: DeviceSession) {
        s.addDisplay().fold(
            onSuccess = { d ->
                display = d
                jobs += scope.launch {
                    d.state.collect { state ->
                        if (state == DisplayState.STARTED) {
                            host.onStatus(id, "connected")
                            render()
                        }
                    }
                }
            },
            onFailure = { e, _ -> host.onStatus(id, e.description) },
        )
    }

    override fun show(lines: List<String>) {
        this.lines = lines
        render()
    }

    private fun render() {
        val d = display ?: return
        if (d.state.value != DisplayState.STARTED || lines.isEmpty()) return
        val shown = lines
        scope.launch {
            d.sendContent {
                flexBox(gap = 8, padding = 16) {
                    for (line in shown) text(line, style = TextStyle.BODY)
                    // Buttons are how the wearer acts on this display (pinch with the band or tap the touchpad)
                    buttonGroup {
                        button(label = "Repeat", style = ButtonStyle.PRIMARY, onClick = { host.onAction(InputAction.REPEAT) })
                        button(label = "Hide", style = ButtonStyle.SECONDARY, onClick = { host.onAction(InputAction.HIDE) })
                    }
                }
            }.onFailure { e, _ -> host.onStatus(id, "send failed: ${e.description}") }
        }
    }

    override fun clear() {
        lines = emptyList()
        val d = display ?: return
        scope.launch { d.clearDisplay() }
    }

    override fun disconnect() {
        wanted = false
        lines = emptyList()
        session?.let {
            it.removeDisplay()
            it.stop()
        }
        session = null
        display = null
        jobs.forEach { it.cancel() }
        jobs.clear()
        host.onStatus(id, "disconnected")
    }
}
