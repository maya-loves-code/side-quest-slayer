import Foundation
import ImageIO
import UIKit
import WidgetKit

private let widgetAppGroup = "group.com.sidequestslayer.app"
private let widgetKind = "QuestMemoriesWidget"

private struct WidgetMemoryRecord: Codable {
  let id: Int
  let questId: Int
  let filename: String
  let timestamp: String
}

private struct WidgetMemoryManifest: Codable {
  let generatedAt: String
  let memories: [WidgetMemoryRecord]
}

@objc(WidgetDataBridge)
final class WidgetDataBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(sync:resolver:rejecter:)
  func sync(
    _ entries: [[String: Any]],
    resolver resolve: @escaping @convention(block) (Any?) -> Void,
    rejecter reject: @escaping @convention(block) (String?, String?, NSError?) -> Void
  ) {
    DispatchQueue.global(qos: .utility).async {
      do {
        try self.writeWidgetCache(entries)
        DispatchQueue.main.async {
          WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
          resolve(nil)
        }
      } catch {
        reject("widget_sync_failed", error.localizedDescription, error as NSError)
      }
    }
  }

  private func writeWidgetCache(_ entries: [[String: Any]]) throws {
    let fileManager = FileManager.default

    guard let containerURL = fileManager.containerURL(
      forSecurityApplicationGroupIdentifier: widgetAppGroup
    ) else {
      throw NSError(
        domain: "WidgetDataBridge",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "The Quest Memories App Group is unavailable."]
      )
    }

    let rootURL = containerURL.appendingPathComponent("QuestMemories", isDirectory: true)
    let photosURL = rootURL.appendingPathComponent("photos", isDirectory: true)
    try fileManager.createDirectory(at: photosURL, withIntermediateDirectories: true)

    var records: [WidgetMemoryRecord] = []

    for entry in entries {
      guard
        let id = (entry["id"] as? NSNumber)?.intValue,
        let questId = (entry["questId"] as? NSNumber)?.intValue,
        let imageURI = entry["imageUri"] as? String,
        let timestamp = entry["timestamp"] as? String
      else {
        continue
      }

      let filename = "memory-\(id).jpg"
      let destinationURL = photosURL.appendingPathComponent(filename)

      if cachedImageNeedsRefresh(at: destinationURL) {
        let sourceURL = localFileURL(from: imageURI)
        try writeOptimizedJPEG(from: sourceURL, to: destinationURL)
      }

      records.append(
        WidgetMemoryRecord(id: id, questId: questId, filename: filename, timestamp: timestamp)
      )
    }

    records.sort { lhs, rhs in
      lhs.timestamp == rhs.timestamp ? lhs.id < rhs.id : lhs.timestamp < rhs.timestamp
    }

    let manifest = WidgetMemoryManifest(
      generatedAt: ISO8601DateFormatter().string(from: Date()),
      memories: records
    )
    let manifestData = try JSONEncoder().encode(manifest)
    try manifestData.write(
      to: rootURL.appendingPathComponent("manifest.json"),
      options: .atomic
    )

    let expectedFilenames = Set(records.map(\.filename))
    let cachedFiles = try fileManager.contentsOfDirectory(
      at: photosURL,
      includingPropertiesForKeys: nil
    )

    for cachedFile in cachedFiles where !expectedFilenames.contains(cachedFile.lastPathComponent) {
      try? fileManager.removeItem(at: cachedFile)
    }
  }

  private func localFileURL(from uri: String) -> URL {
    if let url = URL(string: uri), url.isFileURL {
      return url
    }

    return URL(fileURLWithPath: uri)
  }

  private func cachedImageNeedsRefresh(at url: URL) -> Bool {
    guard
      let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
      let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil)
        as? [CFString: Any],
      let pixelWidth = properties[kCGImagePropertyPixelWidth] as? NSNumber,
      let pixelHeight = properties[kCGImagePropertyPixelHeight] as? NSNumber
    else {
      return true
    }

    return max(pixelWidth.intValue, pixelHeight.intValue) > 1_200
  }

  private func writeOptimizedJPEG(from sourceURL: URL, to destinationURL: URL) throws {
    guard let image = UIImage(contentsOfFile: sourceURL.path) else {
      throw NSError(
        domain: "WidgetDataBridge",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "A quest photo could not be prepared for the widget."]
      )
    }

    let maximumDimension: CGFloat = 1_200
    let longestDimension = max(image.size.width, image.size.height)
    let scale = min(1, maximumDimension / max(longestDimension, 1))
    let targetSize = CGSize(
      width: max(1, (image.size.width * scale).rounded()),
      height: max(1, (image.size.height * scale).rounded())
    )
    let rendererFormat = UIGraphicsImageRendererFormat.default()
    rendererFormat.scale = 1
    rendererFormat.opaque = true
    let renderer = UIGraphicsImageRenderer(size: targetSize, format: rendererFormat)
    let normalizedImage = renderer.image { _ in
      image.draw(in: CGRect(origin: .zero, size: targetSize))
    }

    guard let data = normalizedImage.jpegData(compressionQuality: 0.82) else {
      throw NSError(
        domain: "WidgetDataBridge",
        code: 3,
        userInfo: [NSLocalizedDescriptionKey: "A widget photo could not be encoded."]
      )
    }

    try data.write(to: destinationURL, options: .atomic)
  }
}
