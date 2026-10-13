import SwiftUI
import AVFoundation
import DesignSystem

/// Cold launch: the chain links up on the canvas the launch screen left behind, then hands over to the app.
/// The clip is `public/videos/chain_transparent.webm`, cut to 1.6 s and re-encoded as HEVC with alpha (AVPlayer can't play WebM).
/// Core Animation reads the alpha as premultiplied, so premultiply when re-encoding or the transparent area shows as a box:
/// `ffmpeg -c:v libvpx-vp9 -i chain_transparent.webm -t 1.6 -an -vf "scale=1280:-2,format=rgba,premultiply=inplace=1,format=bgra" -c:v hevc_videotoolbox -alpha_quality 0.75 -q:v 65 -tag:v hvc1 chain.mov`
struct SplashView: View {
    let onEnd: () -> Void
    private let clip = Bundle.main.url(forResource: "chain", withExtension: "mov")

    var body: some View {
        ZStack {
            AL.canvas.ignoresSafeArea()
            if let clip { Clip(url: clip).aspectRatio(16 / 9, contentMode: .fit) }
        }
        .accessibilityHidden(true)
        .task {
            guard clip != nil else { return onEnd() }
            for await _ in NotificationCenter.default.notifications(named: AVPlayerItem.didPlayToEndTimeNotification).map({ _ in () }) { break }
            onEnd()
        }
        .task {
            // In case the clip never plays.
            try? await Task.sleep(for: .seconds(3))
            onEnd()
        }
    }
}

private struct Clip: UIViewRepresentable {
    let url: URL

    final class PlayerView: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
    }

    func makeUIView(context: Context) -> PlayerView {
        let view = PlayerView()
        let player = AVPlayer(url: url)
        (view.layer as? AVPlayerLayer)?.player = player
        player.play()
        return view
    }

    func updateUIView(_ view: PlayerView, context: Context) {}
}

#Preview("Light") { SplashView {} }
#Preview("Dark") { SplashView {}.preferredColorScheme(.dark) }
