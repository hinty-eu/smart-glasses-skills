package dev.smartglasses.livecaptions

/**
 * Turns the caption stream into the few lines a pair of glasses can show.
 *
 * Final captions flow into one running paragraph that is wrapped once, as it arrives, so finished lines never move.
 * The latest partial result continues the last unfinished line and is replaced by the next partial until its final
 * arrives. [fit] returns the newest lines for a [LineBudget]; switching to a target with another width rewraps once.
 */
class CaptionLines(private val keepLines: Int = 60) {
    private val segments = ArrayDeque<String>() // final captions, kept to rewrap for another width
    private val done = ArrayDeque<String>() // full lines at the current width
    private var open = "" // last line of final text, may still grow
    private var cols = 0
    private var partial = ""
    private var lastFinalSeq = -1

    /** The newest final caption, for "repeat" on speech targets. */
    var lastFinal: String = ""
        private set

    /**
     * Returns false when the message changes nothing (an old or repeated sequence number).
     * [repeat] = true marks the server re-sending the last final line ("show this again"): when that line is still the
     * newest one here it is not added a second time; after a clear it comes back once.
     */
    fun onCaption(seq: Int, text: String, final: Boolean, repeat: Boolean = false): Boolean {
        if (seq <= lastFinalSeq) return false
        val clean = normalize(text)
        if (!final) {
            if (clean == partial) return false
            partial = clean
            return true
        }
        lastFinalSeq = seq
        partial = ""
        if (clean.isEmpty()) return true
        if (repeat && segments.lastOrNull() == clean) {
            lastFinal = clean
            return true
        }
        segments.addLast(clean)
        while (segments.size > keepLines) segments.removeFirst()
        if (cols > 0) append(clean)
        lastFinal = clean
        return true
    }

    /** A new connection starts a new stream (the server may have restarted its sequence numbers). */
    fun resetSequence() {
        lastFinalSeq = -1
        partial = ""
    }

    fun clear() {
        segments.clear()
        done.clear()
        open = ""
        partial = ""
        lastFinal = ""
    }

    fun fit(budget: LineBudget): List<String> {
        if (budget.cols != cols) rewrap(budget.cols)
        val tail = when {
            budget.partials && partial.isNotEmpty() -> wrap(join(open, partial), cols)
            open.isNotEmpty() -> listOf(open)
            else -> emptyList()
        }
        return (done.takeLast(budget.lines) + tail).takeLast(budget.lines)
    }

    private fun rewrap(newCols: Int) {
        cols = newCols
        done.clear()
        open = ""
        for (s in segments) append(s)
    }

    private fun append(text: String) {
        val lines = wrap(join(open, text), cols)
        open = lines.lastOrNull() ?: ""
        for (i in 0 until lines.size - 1) done.addLast(lines[i])
        while (done.size > keepLines) done.removeFirst()
    }

    companion object {
        private val SPACES = Regex("\\s+")

        fun normalize(text: String): String = text.replace(SPACES, " ").trim()

        private fun join(a: String, b: String) = if (a.isEmpty()) b else "$a $b"

        /** Greedy word wrap; a word longer than [cols] is cut into pieces. */
        fun wrap(text: String, cols: Int): List<String> {
            require(cols > 0) { "cols must be positive" }
            val out = mutableListOf<String>()
            val line = StringBuilder()
            for (word in normalize(text).split(' ')) {
                var rest = word
                while (rest.length > cols) {
                    if (line.isNotEmpty()) {
                        out += line.toString()
                        line.setLength(0)
                    }
                    out += rest.take(cols)
                    rest = rest.drop(cols)
                }
                if (rest.isEmpty()) continue
                if (line.isNotEmpty() && line.length + 1 + rest.length > cols) {
                    out += line.toString()
                    line.setLength(0)
                }
                if (line.isNotEmpty()) line.append(' ')
                line.append(rest)
            }
            if (line.isNotEmpty()) out += line.toString()
            return out
        }
    }
}
