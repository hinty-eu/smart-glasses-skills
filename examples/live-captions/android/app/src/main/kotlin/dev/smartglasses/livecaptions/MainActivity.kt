package dev.smartglasses.livecaptions

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView

/**
 * One screen: server address, room code, target glasses, Connect, a preview of exactly what is sent to the glasses,
 * and the three shared actions. Everything runs while this Activity lives; a production app would move the
 * controller into a foreground service so captions keep flowing with the screen off.
 */
class MainActivity : Activity(), DisplayHost {
    override val activity: Activity get() = this

    /** The display-text ladder, best rung first. The Meta entry exists only in the meta flavor. */
    private val targets: List<Pair<String, () -> GlassesDisplay>> by lazy {
        listOfNotNull(
            "Phone preview only (no glasses)" to { PhonePreviewDisplay(this) },
            "Rokid Glasses (CXR-L SDK)" to { RokidDisplay(this) },
            "Vuzix Z100 (Ultralite SDK)" to { VuzixDisplay(this) },
            Flavor.metaDisplay(this)?.let { meta -> "Meta Ray-Ban Display (DAT)" to { meta } },
            "USB-C display glasses (Presentation)" to { PresentationDisplay(this) },
            "Notification mirrored by the glasses app" to { NotificationDisplay(this) },
            "Voice in the ear (text-to-speech)" to { SpeechDisplay(this) },
        )
    }
    private val created = mutableMapOf<Int, GlassesDisplay>()
    private var current: GlassesDisplay? = null
    private var running = false
    private val permissionCallbacks = mutableMapOf<Int, (Boolean) -> Unit>()
    private var nextRequestCode = 100

    private lateinit var server: EditText
    private lateinit var room: EditText
    private lateinit var target: Spinner
    private lateinit var connect: Button
    private lateinit var socketState: TextView
    private lateinit var displayState: TextView
    private lateinit var preview: TextView

    private val controller by lazy {
        CaptionController(
            onPreview = { lines, hidden -> preview.text = if (hidden) "(hidden)" else lines.joinToString("\n") },
            onSocketState = { socketState.text = "Server: $it" },
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildUi())
        val prefs = getPreferences(MODE_PRIVATE)
        server.setText(prefs.getString("server", ""))
        room.setText(prefs.getString("room", ""))
        NotificationDisplay.onAction = { controller.onAction(it) }
        Flavor.onCreate(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        Flavor.onIntent(this, intent)
    }

    override fun onDestroy() {
        NotificationDisplay.onAction = null
        if (running) controller.stop()
        super.onDestroy()
    }

    private fun selected(): GlassesDisplay {
        val i = target.selectedItemPosition
        return created.getOrPut(i) { targets[i].second() }
    }

    private fun toggle() {
        if (running) {
            controller.stop()
            running = false
            current = null
            connect.text = "Connect"
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            return
        }
        val host = server.text.toString().trim()
        val code = room.text.toString().trim().uppercase()
        if (host.isEmpty() || code.length != 6) {
            socketState.text = "Server: enter the address and the 6-character room code the server printed"
            return
        }
        getPreferences(MODE_PRIVATE).edit().putString("server", host).putString("room", code).apply()
        val d = selected()
        current = d
        running = true
        connect.text = "Disconnect"
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        controller.start(host, code, d)
    }

    // DisplayHost

    override fun onStatus(displayId: String, status: String) {
        displayState.text = "Glasses ($displayId): $status"
    }

    override fun onAction(action: InputAction) = controller.onAction(action)

    override fun requestPermissions(vararg permissions: String, then: (granted: Boolean) -> Unit) {
        val missing = permissions.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) return then(true)
        val code = nextRequestCode++
        permissionCallbacks[code] = then
        requestPermissions(missing.toTypedArray(), code)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        permissionCallbacks.remove(requestCode)?.invoke(granted)
    }

    /** Rokid's authorization screen in Hi Rokid answers here. */
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        created.values.filterIsInstance<ActivityResultAware>().forEach { it.onActivityResult(requestCode, resultCode, data) }
    }

    // UI, built in code to keep the example to a few files

    private fun buildUi(): ScrollView {
        val pad = (16 * resources.displayMetrics.density).toInt()
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }
        fun label(text: String) = TextView(this).apply { this.text = text }

        server = EditText(this).apply {
            hint = "192.168.1.20:8787 (10.0.2.2:8787 in the emulator)"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            isSingleLine = true
        }
        room = EditText(this).apply {
            hint = "Room code, e.g. K7QM2X"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            filters = arrayOf(InputFilter.AllCaps(), InputFilter.LengthFilter(6))
            isSingleLine = true
        }
        target = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, targets.map { it.first })
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                    if (!running) return
                    val d = selected()
                    if (d !== current) {
                        current = d
                        controller.setDisplay(d)
                    }
                }

                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }
        }
        connect = Button(this).apply {
            text = "Connect"
            setOnClickListener { toggle() }
        }
        socketState = label("Server: disconnected")
        displayState = label("Glasses: not started")
        preview = TextView(this).apply {
            setBackgroundColor(Color.BLACK)
            setTextColor(Color.rgb(0, 230, 0))
            typeface = Typeface.MONOSPACE
            minLines = 3
            setPadding(pad, pad, pad, pad)
        }
        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            for (a in InputAction.entries) {
                addView(
                    Button(this@MainActivity).apply {
                        text = a.wire
                        setOnClickListener { controller.onAction(a) }
                    },
                    LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f),
                )
            }
        }

        listOf(
            label("Caption server"), server, label("Room"), room, label("Glasses"), target, connect,
            socketState, displayState, label("Sent to the glasses"), preview, actions,
        ).forEach { column.addView(it, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT)) }
        return ScrollView(this).apply { addView(column) }
    }
}
