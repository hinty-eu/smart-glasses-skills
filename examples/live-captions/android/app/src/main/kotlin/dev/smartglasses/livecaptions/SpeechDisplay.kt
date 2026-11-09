package dev.smartglasses.livecaptions

import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener

/**
 * Rung 5: voice in the ear. Final captions are read aloud with the phone's TextToSpeech; with any Bluetooth glasses
 * or earbuds connected the system routes the audio there (A2DP), so this works on audio-only pairs such as Ray-Ban Meta.
 *
 * Media usage with speech content goes to the Bluetooth media route at media volume. Transient "may duck" focus lowers
 * music or a podcast while a caption is read and gives it back afterwards. Only finals are spoken: partials would
 * restart the sentence many times a second.
 */
class SpeechDisplay(private val host: DisplayHost) : GlassesDisplay {
    override val id = "speech"
    override val budget = LineBudget(lines = 1, cols = 80, partials = false)

    private val app = host.activity.applicationContext
    private val audio = app.getSystemService(AudioManager::class.java)
    private val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
    private val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(attributes)
        .build()
    private var tts: TextToSpeech? = null
    private var ready = false
    private var pending = 0
    private var counter = 0

    override fun connect() {
        if (tts != null) return
        host.onStatus(id, "starting text-to-speech")
        // The init callback runs on the main thread
        tts = TextToSpeech(app) { status -> onInit(status == TextToSpeech.SUCCESS) }
    }

    private fun onInit(ok: Boolean) {
        ready = ok
        val engine = tts
        if (!ok || engine == null) return host.onStatus(id, "text-to-speech failed to start")
        engine.setAudioAttributes(attributes)
        engine.setOnUtteranceProgressListener(progress)
        // The phone's default TTS language is used; set engine.language to match the caption language
        host.onStatus(id, "ready, connect Bluetooth glasses or earbuds")
    }

    private val progress = object : UtteranceProgressListener() {
        // These run on a TTS thread: post back to the main thread before touching state
        override fun onStart(utteranceId: String?) = Unit

        override fun onDone(utteranceId: String?) {
            host.activity.runOnUiThread { finished() }
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
            host.activity.runOnUiThread { finished() }
        }
    }

    private fun finished() {
        pending = (pending - 1).coerceAtLeast(0)
        if (pending == 0) audio.abandonAudioFocusRequest(focus)
    }

    override fun show(lines: List<String>) = Unit // nothing to draw

    override fun onFinal(text: String) {
        val engine = tts ?: return
        if (!ready || text.isBlank()) return
        if (pending == 0 && audio.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_FAILED) return // e.g. a phone call
        pending++
        engine.speak(text, TextToSpeech.QUEUE_ADD, null, "caption-${counter++}")
    }

    /** Skip and hide stop the current sentence and drop the queue. */
    override fun clear() {
        tts?.stop()
        pending = 0
        audio.abandonAudioFocusRequest(focus)
    }

    override fun disconnect() {
        clear()
        tts?.shutdown()
        tts = null
        ready = false
        host.onStatus(id, "disconnected")
    }
}
