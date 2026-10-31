# AnyLink

A personal link library: saved links, notes and images filed into collections, on the web and on iOS.

## Language

### Library

**Library**:
Everything one user has saved, across all their collections.

**Collection**:
A named group in a library that each link belongs to exactly one of.
_Avoid_: Folder, list, board

**Inbox**:
The one collection per library where links land when no collection was picked.

**Smart collection**:
A saved search over the whole library, shown alongside collections but owning no links.
_Avoid_: Filter, custom filter

### Sharing

**Shared collection**:
A collection its owner has made readable by anyone holding its share link, always showing its current contents.
_Avoid_: Public collection, published collection

**Share link**:
The unguessable URL that opens a shared collection; turning sharing off destroys it for good.
_Avoid_: Invite, public link

**Viewer**:
Anyone opening a share link, signed in or not, who can read but never change the shared collection.
_Avoid_: Guest, follower, collaborator

**Display name**:
The name a user chooses to appear as on their shared collections.
_Avoid_: Username, handle

**Save** (from a shared collection):
Copying one link, or a whole shared collection, into the viewer's own library, after which the copy has no tie to the original.
_Avoid_: Follow, clone, import

### Plans

**Plan**:
Whether an account is Free or Pro, as recorded on the server, which is the only source of truth for it.
_Avoid_: Tier, membership

**Pro**:
The paid plan, bought only in the iOS app, that joins web and iOS into one server library and unlocks the features the server pays for.
_Avoid_: Premium, Plus, subscription (a subscription is one way to buy Pro; lifetime is another)

**Local library**:
A free iOS user's library, kept on the device and synced between their Apple devices through iCloud, never stored on AnyLink's server.
_Avoid_: iCloud library, offline library, guest library

**Server library**:
A library stored on AnyLink's server: every web account has one, and a Pro user's iOS app uses it too.
_Avoid_: Cloud library, account library

**Upgrade**:
Moving a local library into the server library when an account becomes Pro, merged with whatever the server library already holds.
_Avoid_: Migration, sync-up

**Lapse**:
Pro ending without renewal, after which iOS falls back to a local library copied from the server library, and nothing is deleted.
_Avoid_: Downgrade, cancellation

### Link detail

**Template**:
A Pro detail layout built for one content type: e-commerce, article, video or recipe.
_Avoid_: Theme, skin, view type

**Generic layout**:
The one detail layout a free account sees for every content type.
_Avoid_: Default template, basic view
