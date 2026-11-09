package dev.smartglasses.livecaptions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptionLinesTest {
    private val budget = LineBudget(lines = 2, cols = 12)

    @Test
    fun wrapsOnWordsAndCutsLongWords() {
        assertEquals(listOf("the quick", "brown fox"), CaptionLines.wrap("the quick brown fox", 10))
        assertEquals(listOf("abcde", "fghij", "k"), CaptionLines.wrap("abcdefghijk", 5))
    }

    @Test
    fun partialReplacesUntilFinal() {
        val c = CaptionLines()
        c.onCaption(1, "hello", final = false)
        c.onCaption(1, "hello wor", final = false)
        assertEquals(listOf("hello wor"), c.fit(budget))
        c.onCaption(1, "hello world", final = true)
        c.onCaption(2, "how are", final = false)
        assertEquals(listOf("hello world", "how are"), c.fit(budget))
    }

    @Test
    fun finishedLinesDoNotMoveAndOnlyTheNewestAreKept() {
        val c = CaptionLines()
        c.onCaption(1, "one two three four", final = true)
        assertEquals(listOf("one two", "three four"), c.fit(LineBudget(lines = 2, cols = 10)))
        c.onCaption(2, "five", final = true)
        assertEquals(listOf("three four", "five"), c.fit(LineBudget(lines = 2, cols = 10)))
    }

    @Test
    fun finalOnlyTargetsIgnorePartials() {
        val c = CaptionLines()
        c.onCaption(1, "done", final = true)
        c.onCaption(2, "still talk", final = false)
        assertEquals(listOf("done"), c.fit(budget.copy(partials = false)))
    }

    @Test
    fun repeatShowsTheLastLineAgainWithoutAddingIt() {
        val c = CaptionLines()
        c.onCaption(1, "one two", final = true)
        c.onCaption(2, "three", final = false)
        assertTrue(c.onCaption(3, "one two", final = true, repeat = true))
        assertEquals(listOf("one two"), c.fit(budget)) // the partial is dropped, the line is not doubled
        c.clear() // "hide" cleared the screen: a repeat brings the line back once
        c.onCaption(4, "one two", final = true, repeat = true)
        assertEquals(listOf("one two"), c.fit(budget))
    }

    @Test
    fun oldAndRepeatedSequencesAreIgnoredUntilReconnect() {
        val c = CaptionLines()
        c.onCaption(5, "five", final = true)
        assertFalse(c.onCaption(5, "five", final = true))
        assertFalse(c.onCaption(3, "three", final = false))
        c.resetSequence() // new socket, the server may start again at 0
        c.onCaption(0, "zero", final = true)
        assertEquals(listOf("five zero"), c.fit(budget))
    }
}
