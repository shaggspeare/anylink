# AnyLink

A personal link library: saved links, notes and images filed into collections, synced between the web app and iOS.

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
