import AVFoundation
import ExpoModulesCore

public class LiveKeepAliveModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveKeepAlive")

    AsyncFunction("start") { (_title: String, _body: String, _endUrl: String, _authorization: String, _apiKey: String) in
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(
        .playAndRecord,
        mode: .videoRecording,
        options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers]
      )
      try session.setActive(true)
    }

    AsyncFunction("stop") {
      // Stream stop is handled by the publisher view. Keep the audio session as-is.
    }
  }
}
