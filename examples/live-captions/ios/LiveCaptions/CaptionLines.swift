import Foundation

/// Turns the caption stream into the few lines a pair of glasses can show. Same algorithm as the Android target.
///
/// Final captions flow into one running paragraph that is wrapped once, as it arrives, so finished lines never move.
/// The latest partial result continues the last unfinished line and is replaced by the next partial until its final
/// arrives. `fit` returns the newest lines for a budget; switching to a target with another width rewraps once.
struct CaptionLines {
  private let keepLines: Int
  private var segments: [String] = []  // final captions, kept to rewrap for another width
  private var done: [String] = []  // full lines at the current width
  private var open = ""  // last line of final text, may still grow
  private var cols = 0
  private var partial = ""
  private var lastFinalSeq = -1

  /// The newest final caption, for "repeat" on speech targets.
  private(set) var lastFinal = ""

  init(keepLines: Int = 60) { self.keepLines = keepLines }

  /// Returns false when the message changes nothing (an old or repeated sequence number).
  /// `isRepeat` marks the server re-sending the last final line ("show this again"): when that line is still the newest
  /// one here it is not added a second time; after a clear it comes back once.
  mutating func onCaption(seq: Int, text: String, final: Bool, isRepeat: Bool = false) -> Bool {
    if seq <= lastFinalSeq { return false }
    let clean = Self.normalize(text)
    if !final {
      if clean == partial { return false }
      partial = clean
      return true
    }
    lastFinalSeq = seq
    partial = ""
    if clean.isEmpty { return true }
    if isRepeat && segments.last == clean {
      lastFinal = clean
      return true
    }
    segments.append(clean)
    if segments.count > keepLines { segments.removeFirst(segments.count - keepLines) }
    if cols > 0 { append(clean) }
    lastFinal = clean
    return true
  }

  /// A new connection starts a new stream (the server may have restarted its sequence numbers).
  mutating func resetSequence() {
    lastFinalSeq = -1
    partial = ""
  }

  mutating func clear() {
    segments.removeAll()
    done.removeAll()
    open = ""
    partial = ""
    lastFinal = ""
  }

  mutating func fit(_ budget: LineBudget) -> [String] {
    if budget.cols != cols { rewrap(budget.cols) }
    let tail: [String]
    if budget.partials && !partial.isEmpty {
      tail = Self.wrap(Self.join(open, partial), cols: cols)
    } else {
      tail = open.isEmpty ? [] : [open]
    }
    return Array((done.suffix(budget.lines) + tail).suffix(budget.lines))
  }

  private mutating func rewrap(_ newCols: Int) {
    cols = newCols
    done.removeAll()
    open = ""
    for s in segments { append(s) }
  }

  private mutating func append(_ text: String) {
    let lines = Self.wrap(Self.join(open, text), cols: cols)
    open = lines.last ?? ""
    done.append(contentsOf: lines.dropLast())
    if done.count > keepLines { done.removeFirst(done.count - keepLines) }
  }

  static func normalize(_ text: String) -> String {
    text.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
  }

  private static func join(_ a: String, _ b: String) -> String { a.isEmpty ? b : a + " " + b }

  /// Greedy word wrap counted in characters (grapheme clusters); a word longer than `cols` is cut into pieces.
  static func wrap(_ text: String, cols: Int) -> [String] {
    precondition(cols > 0, "cols must be positive")
    var out: [String] = []
    var line = ""
    for word in normalize(text).split(separator: " ") {
      var rest = word
      while rest.count > cols {
        if !line.isEmpty {
          out.append(line)
          line = ""
        }
        out.append(String(rest.prefix(cols)))
        rest = rest.dropFirst(cols)
      }
      if rest.isEmpty { continue }
      if !line.isEmpty && line.count + 1 + rest.count > cols {
        out.append(line)
        line = ""
      }
      line += line.isEmpty ? String(rest) : " " + String(rest)
    }
    if !line.isEmpty { out.append(line) }
    return out
  }
}
