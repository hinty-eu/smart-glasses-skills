package dev.smartglasses.livecaptions

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * WebSocket client for the example server (`ws://HOST:PORT/ws?room=CODE`).
 * Server to client: `{"type":"caption","seq":12,"text":"...","final":false}` and `{"type":"clear"}`. A caption with
 * `"repeat":true` is the last final line sent again because someone pressed repeat: show it again, do not add it twice.
 * Client to server: `{"type":"hello",...}` on every (re)connect and `{"type":"action","action":"repeat"}`.
 * Reconnects with backoff while [open] is in effect. Every callback arrives on the main thread.
 */
class CaptionSocket(private val listener: Listener) {
    interface Listener {
        fun onSocketState(state: String)

        /** Called after every successful (re)connect: sequence numbers start over. */
        fun onSocketOpen()

        /** [repeat] = true: the server re-sent the last final line for a "repeat" action. */
        fun onCaption(seq: Int, text: String, final: Boolean, repeat: Boolean)

        fun onClear()
    }

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS) // keeps NAT and Wi-Fi power save from dropping an idle socket
        .build()
    private val main = Handler(Looper.getMainLooper())
    private var socket: WebSocket? = null
    private var url: String? = null
    private var hello: JSONObject? = null
    private var attempt = 0
    private val reconnect = Runnable { connectNow() }

    /** [server] is "192.168.1.20:8787" or a full ws:// or wss:// URL. */
    fun open(server: String, room: String, hello: JSONObject) {
        close()
        this.url = buildUrl(server, room)
        this.hello = hello
        attempt = 0
        connectNow()
    }

    /** Re-announce the target, e.g. after the user picked other glasses. */
    fun sendHello(hello: JSONObject) {
        this.hello = hello
        socket?.send(hello.toString())
    }

    fun sendAction(action: InputAction) {
        socket?.send(JSONObject().put("type", "action").put("action", action.wire).toString())
    }

    fun close() {
        url = null
        main.removeCallbacks(reconnect)
        socket?.close(1000, "bye")
        socket = null
    }

    private fun connectNow() {
        val target = url ?: return
        listener.onSocketState(if (attempt == 0) "connecting" else "reconnecting")
        socket = client.newWebSocket(Request.Builder().url(target).build(), Events())
    }

    private fun scheduleReconnect() {
        if (url == null) return
        attempt++
        val delayMs = minOf(10_000L, 1_000L shl minOf(attempt - 1, 4)) // 1, 2, 4, 8, 10 s
        listener.onSocketState("offline, retry in ${delayMs / 1000} s")
        main.postDelayed(reconnect, delayMs)
    }

    private inner class Events : WebSocketListener() {
        // Ignore late events from a socket we already replaced or closed
        private fun WebSocket.isCurrent() = this === socket

        override fun onOpen(webSocket: WebSocket, response: Response) {
            main.post {
                if (!webSocket.isCurrent()) return@post
                attempt = 0
                hello?.let { webSocket.send(it.toString()) }
                listener.onSocketOpen()
                listener.onSocketState("connected")
            }
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            val msg = try {
                JSONObject(text)
            } catch (_: Exception) {
                return
            }
            main.post {
                if (!webSocket.isCurrent()) return@post
                when (msg.optString("type")) {
                    "caption" -> listener.onCaption(
                        msg.optInt("seq", 0),
                        msg.optString("text"),
                        msg.optBoolean("final", false),
                        msg.optBoolean("repeat", false),
                    )
                    "clear" -> listener.onClear()
                }
            }
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            main.post { if (webSocket.isCurrent()) scheduleReconnect() }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            main.post { if (webSocket.isCurrent()) scheduleReconnect() }
        }
    }

    companion object {
        fun buildUrl(server: String, room: String): String {
            var base = server.trim().trimEnd('/')
            if (!base.startsWith("ws://") && !base.startsWith("wss://")) base = "ws://$base"
            if (!base.substringAfter("://").contains('/')) base += "/ws"
            return "$base?room=${room.trim().uppercase()}"
        }
    }
}
