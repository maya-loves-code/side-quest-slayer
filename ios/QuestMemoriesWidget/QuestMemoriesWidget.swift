import SwiftUI
import UIKit
import WidgetKit

private let appGroupIdentifier = "group.com.sidequestslayer.app"
private let questMemoriesWidgetKind = "QuestMemoriesWidget"

private struct SharedMemory: Codable, Identifiable {
  let id: Int
  let questId: Int
  let filename: String
  let timestamp: String
}

private struct SharedMemoryManifest: Codable {
  let generatedAt: String
  let memories: [SharedMemory]
}

private struct QuestMemoryEntry: TimelineEntry {
  let date: Date
  let memory: SharedMemory?
}

private struct SeededGenerator: RandomNumberGenerator {
  private var state: UInt64

  init(seed: UInt64) {
    state = seed == 0 ? 0x9E3779B97F4A7C15 : seed
  }

  mutating func next() -> UInt64 {
    state &+= 0x9E3779B97F4A7C15
    var value = state
    value = (value ^ (value >> 30)) &* 0xBF58476D1CE4E5B9
    value = (value ^ (value >> 27)) &* 0x94D049BB133111EB
    return value ^ (value >> 31)
  }
}

private struct QuestMemoriesProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuestMemoryEntry {
    QuestMemoryEntry(date: Date(), memory: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (QuestMemoryEntry) -> Void) {
    let memories = WidgetMemoryStore.loadMemories()
    completion(QuestMemoryEntry(date: Date(), memory: memory(at: Date(), from: memories)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<QuestMemoryEntry>) -> Void) {
    let memories = WidgetMemoryStore.loadMemories()
    let now = Date()

    guard !memories.isEmpty else {
      completion(
        Timeline(
          entries: [QuestMemoryEntry(date: now, memory: nil)],
          policy: .after(now.addingTimeInterval(5 * 60))
        )
      )
      return
    }

    let calendar = Calendar.autoupdatingCurrent
    let currentHour = calendar.dateInterval(of: .hour, for: now)?.start ?? now
    let dates = (0..<24).compactMap { offset in
      calendar.date(byAdding: .hour, value: offset, to: currentHour)
    }
    let entries = dates.map { date in
      QuestMemoryEntry(date: date, memory: memory(at: date, from: memories))
    }
    let refreshDate = calendar.date(byAdding: .hour, value: 24, to: currentHour)
      ?? now.addingTimeInterval(24 * 60 * 60)

    completion(Timeline(entries: entries, policy: .after(refreshDate)))
  }

  private func memory(at date: Date, from memories: [SharedMemory]) -> SharedMemory? {
    guard !memories.isEmpty else {
      return nil
    }

    let hour = Int(date.timeIntervalSince1970 / 3_600)
    let count = memories.count
    let cycle = hour / count
    let position = hour % count
    var generator = SeededGenerator(seed: UInt64(cycle) &+ 0x534C41594552)
    var orderedMemories = memories.shuffled(using: &generator)

    if count > 1 && position == 0 && cycle > 0 {
      var previousGenerator = SeededGenerator(seed: UInt64(cycle - 1) &+ 0x534C41594552)
      let previousMemories = memories.shuffled(using: &previousGenerator)

      if orderedMemories.first?.id == previousMemories.last?.id {
        orderedMemories.swapAt(0, 1)
      }
    }

    return orderedMemories[position]
  }
}

private enum WidgetMemoryStore {
  static func loadMemories() -> [SharedMemory] {
    guard
      let rootURL = rootURL,
      let data = try? Data(contentsOf: rootURL.appendingPathComponent("manifest.json")),
      let manifest = try? JSONDecoder().decode(SharedMemoryManifest.self, from: data)
    else {
      return []
    }

    return manifest.memories.filter { memory in
      FileManager.default.fileExists(
        atPath: rootURL
          .appendingPathComponent("photos", isDirectory: true)
          .appendingPathComponent(memory.filename)
          .path
      )
    }
  }

  static func image(for memory: SharedMemory) -> UIImage? {
    guard let rootURL else {
      return nil
    }

    let imageURL = rootURL
      .appendingPathComponent("photos", isDirectory: true)
      .appendingPathComponent(memory.filename)
    return UIImage(contentsOfFile: imageURL.path)
  }

  private static var rootURL: URL? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)?
      .appendingPathComponent("QuestMemories", isDirectory: true)
  }
}

private struct QuestMemoriesWidgetView: View {
  let entry: QuestMemoryEntry

  var body: some View {
    Group {
      if #available(iOSApplicationExtension 17.0, *) {
        widgetContent
          .containerBackground(for: .widget) {
            Color(red: 1, green: 250 / 255, blue: 240 / 255)
          }
      } else {
        widgetContent
          .background(Color(red: 1, green: 250 / 255, blue: 240 / 255))
      }
    }
    .widgetURL(widgetURL)
  }

  private var widgetURL: URL? {
    guard let id = entry.memory?.id else {
      return URL(string: "sidequestslayer://")
    }

    return URL(string: "sidequestslayer://moment/\(id)")
  }

  private var widgetContent: some View {
    GeometryReader { proxy in
      let cardWidth = min(proxy.size.width * 0.74, 270)
      let cardHeight = min(proxy.size.height * 0.86, 320)

      ZStack {
        Color(red: 1, green: 250 / 255, blue: 240 / 255)

        PolaroidMemoryView(
          memory: entry.memory,
          cardWidth: cardWidth,
          cardHeight: cardHeight
        )
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }
}

private struct PolaroidMemoryView: View {
  let memory: SharedMemory?
  let cardWidth: CGFloat
  let cardHeight: CGFloat

  private var photoHeight: CGFloat {
    cardHeight * 0.69
  }

  var body: some View {
    ZStack(alignment: .top) {
      VStack(spacing: 0) {
        photo
          .frame(width: cardWidth - 24, height: photoHeight)
          .clipped()

        if let memory {
          Text(formattedDate(memory.timestamp))
            .font(.custom("Noteworthy", size: 15, relativeTo: .caption))
            .foregroundStyle(Color(red: 95 / 255, green: 86 / 255, blue: 104 / 255))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 12)
        }
      }
      .padding(.top, 12)
      .padding(.horizontal, 12)
      .padding(.bottom, 8)
      .frame(width: cardWidth, height: cardHeight)
      .background(Color(red: 1, green: 254 / 255, blue: 249 / 255))
      .shadow(
        color: Color(red: 124 / 255, green: 58 / 255, blue: 237 / 255).opacity(0.18),
        radius: 10,
        x: 0,
        y: 6
      )

      Rectangle()
        .fill(Color(red: 233 / 255, green: 217 / 255, blue: 183 / 255).opacity(0.82))
        .frame(width: cardWidth * 0.36, height: 20)
        .rotationEffect(.degrees(-2))
        .offset(y: -9)
        .shadow(color: .black.opacity(0.04), radius: 1, x: 0, y: 1)
    }
  }

  @ViewBuilder
  private var photo: some View {
    if let memory, let image = WidgetMemoryStore.image(for: memory) {
      Image(uiImage: image)
        .resizable()
        .scaledToFill()
    } else {
      Color(red: 237 / 255, green: 227 / 255, blue: 1)
    }
  }

  private func formattedDate(_ timestamp: String) -> String {
    guard let date = Self.fractionalISOFormatter.date(from: timestamp)
      ?? Self.isoFormatter.date(from: timestamp)
    else {
      return ""
    }

    return Self.displayFormatter.string(from: date).uppercased()
  }

  private static let isoFormatter = ISO8601DateFormatter()

  private static let fractionalISOFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  private static let displayFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "MMM d, yyyy"
    return formatter
  }()
}

struct QuestMemoriesWidget: Widget {
  var body: some WidgetConfiguration {
    configuration
  }

  private var configuration: some WidgetConfiguration {
    StaticConfiguration(
      kind: questMemoriesWidgetKind,
      provider: QuestMemoriesProvider()
    ) { entry in
      QuestMemoriesWidgetView(entry: entry)
    }
    .configurationDisplayName("Quest Memories")
    .description("Relive your quest photos, one memory at a time.")
    .supportedFamilies([.systemLarge])
  }
}

@main
struct QuestMemoriesWidgetBundle: WidgetBundle {
  var body: some Widget {
    QuestMemoriesWidget()
  }
}
