# Shared collections are public by token, read-only, and saved by copying

Every other read in AnyLink requires a signed-in user and only touches that user's library. Shared collections (wishlists, book lists) deliberately break that: anyone with the share link can read the collection's live contents without an account, because the people a wishlist is meant for usually don't use AnyLink. The share token is the only credential, so turning sharing off deletes it, and turning sharing back on mints a new one. That's how an owner cuts off someone who already has the link. Viewers never write to the owner's data. "Save" copies links into the viewer's own library instead of following the original.

## Considered Options

- **Invite specific accounts**: rejected because recipients would have to sign up just to see a wishlist.
- **Gift reservation ("I'm buying this")**: deferred. It's the natural next step for wishlists, but it means anonymous writes and owner-blind state.
- **Follow (stay synced) instead of copy**: rejected for now, because it would turn the library from "mine" into "mine + followed" everywhere: sync, search, sidebar and iOS storage.
- **Snapshot at share time**: rejected, because a wishlist that doesn't update when you edit it is useless.

## Consequences

- The public read path exposes only an allow-listed set of fields: title, image, domain, excerpt, the owner's note, current price, and pinned/manual order. It never exposes highlights, tags, favourites, price history, alerts, article text or the owner's email.
- Only regular collections can be shared. The Inbox and smart collections can't, because a smart collection searches the whole library and could leak unrelated links.
- Saved copies carry the crawled data but not the owner's note. Duplicates are allowed, as everywhere else in the app.
