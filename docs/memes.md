# Memes: saved images you can paste anywhere

Built 2026-11-15. A saved image (share sheet, Photos picker, paste or drop on the web) is now a meme vault entry:
kept as it came, searchable by the words on it, and one tap from the clipboard of whatever app you're replying in.

## What changed

**Kept as uploaded.** `uploadImage` stores the original (`<id>.gif|png|jpg|webp`) as the link's `url` beside the
`<id>.webp` preview in `heroImage`. A GIF keeps moving: the web detail view and the iOS detail view (a `WebView`)
play the original; Copy and Share hand out the original; the card shows the preview. iOS keeps GIFs as `.gif` in the
App Group too (`LocalImages`). Purge and the shared-collection copy clean up or copy every variant.

**Read on save.**
- iOS runs Vision (`LocalImages.text`) before the card appears, on every plan, offline. The words go into
  `excerpt`, the first line becomes the title when there's no caption. That's what search, Spotlight and the
  query language already index.
- The server asks Claude (`describeImage`) for a caption, the text and 2–5 tags when the account gets AI
  (`fullCrawls`), inline with a 20 s cap. If it doesn't answer, `aiPending` is set and `enrichLink` runs it the
  next time the link opens, on both clients. The model's text replaces the device's; a user's caption always wins.
- `createImage` takes a fifth argument, `text`, for the device's read. Uploaded local libraries get `aiPending`.

**Getting it out.**
- Web: **Copy image** on the image page and in every card's action sheet, for saved images and for any page
  with a hero picture (a meme in an X post). PNG on the clipboard, which is what X, Threads and Instagram's web
  composers take. A GIF copies as its first frame; Share or Open full size keep it moving.
- iOS: **Copy Image** in the context menu for the same set; the detail view's Copy puts a GIF on the pasteboard
  as a GIF, so Messages and X paste it animated.
- **Memes widget** (medium: 3, large: 6): tap a tile → `CopyImageIntent` → clipboard. The intent file is in the
  app and the widget target, so the system runs it in the app.
- **Siri / Shortcuts:** "Copy a meme from AnyLink" → `CopyMemeIntent` asks for a few words, finds the newest
  image whose title, text, tags or note contain all of them, copies it, and returns the file for the rest of a
  shortcut.
- **AnyLink Memes keyboard** (`ios/Keyboard`, target `AnyLinkKeyboard`): a grid of the saved images with tag
  chips; tap → clipboard → "Copied. Now paste it." Needs Full Access (App Group + clipboard); without it the
  keyboard explains where to turn it on.

**Capture from X.** `fetchTweet` reads a post through the syndication endpoint that powers embedded tweets, so
`x.com/…/status/…` saves as a card with the post's text and its first picture as the hero (re-hosted like any
hero). A GIF or video post keeps its poster frame. If the endpoint fails, the normal crawl chain takes over.

**Smaller things.** Image cards show the whole image on a dark mat (`object-contain` / `.fit`), not a crop.
Spotlight results for images carry a thumbnail. The Add sheet's tile reads "Meme, screenshot or photo".

## Check on a device before shipping

- [ ] Tap a Memes widget tile with the app closed, then paste in Messages. The intent writes
      `UIPasteboard.general` from the app's process in the background; if iOS drops the write, give
      `CopyImageIntent` `supportedModes = .foreground` so it opens the app for a moment.
- [ ] Keyboard: enable it, allow Full Access, paste a GIF into Messages and a PNG into X.
- [ ] Share a GIF from Safari (long-press → Share) and confirm it moves in the detail view and after Copy.
- [ ] Save an `x.com` post with a picture. If cards come back with no picture, the syndication endpoint changed:
      `fetchTweet` logs and the crawl falls through, nothing breaks.
- [ ] Keyboard memory: scroll a library of 200+ images. Thumbs are 240 px; drop to 160 if it gets killed.

## Not built, on purpose

- MP4 memes. Instagram's app wants video, not GIF; `uploadImage` would need a video path and the keyboard a
  player. Add when someone asks.
- Instagram and Threads capture. No public read path; long-press → Save, then share from Photos works today.
- Near-duplicate detection. Saving the same meme twice is harmless.
