# 06 · Query language

One language powers search, built-in filters, tag chips, custom filters and "show all matches". It is implemented in
`AnyLinkKit/Sources/QueryLanguage` and must behave **exactly** like the web app (spec §4.8), because saved filters
are shared between the web and iOS.

## Grammar

```
query    := term*                       (whitespace separated)
term     := "-"? atom
atom     := "match:or"
          | "#" word                     tag prefix
          | field ":" value              field ∈ title excerpt note link type is created
          | quoted                       "exact phrase"
          | word
value    := word | quoted | (">" | "<") word        (comparison only for created)
quoted   := '"' [^"]* '"'
```

- An unknown `field:` (e.g. a pasted `https://…`) is treated as a plain word, including the colon.
- Matching is case-insensitive, by substring.

## Semantics

| Syntax | Matches when |
|---|---|
| `word`, `"phrase"` | substring of title, excerpt, domain, url, note, any tag, **or any `articleText` block** |
| `#tag` | some tag **starts with** `tag` (`#des` matches `design`) |
| `title:x` `excerpt:x` `note:x` | substring of that field |
| `link:x` | substring of domain or url |
| `type:article\|video\|product` | `contentType` equals |
| `is:favorite` `is:noted` `is:untagged` `is:duplicate` `is:broken` `is:archived` | flag (duplicate = same URL lowercased, trailing `/` removed, appears more than once; broken = httpStatus ∈ {0,1,404,410}) |
| `created:2026-01` | `createdAt` ISO string has that prefix |
| `created:>2026-01-15`, `created:<2026-01` | string comparison on the ISO date |
| `-term` | exclusion; works with any atom |
| `match:or` | positive terms match if **any** matches (default: all). Exclusions always apply. |

**Archived links are excluded** from every result unless the query contains `is:archived`.
Trash (`deleted`) is never searched.

## Types

```swift
public struct Query: Hashable, Sendable {
    public var terms: [Term]
    public var matchAny: Bool
    public init(_ string: String)            // parse
    public var string: String { get }        // canonical serialisation (round-trips)
    public func matches(_ link: LinkItem, in library: LibraryIndex) -> Bool
    public func matchLocation(_ link: LinkItem) -> MatchLocation?   // .title, .summary, .note, .article, .tags, .domain: drives the snippet UI
}
public enum Term: Hashable, Sendable {
    case text(String, negated: Bool)
    case tag(String, negated: Bool)
    case field(Field, String, negated: Bool)
    case type(ContentType, negated: Bool)
    case flag(Flag, negated: Bool)
    case created(DateComparison, String, negated: Bool)
}
```

`LibraryIndex` precomputes duplicate URLs and a lowercased haystack per link, so typing stays under 16 ms for 5,000
links. Benchmark this in a test.

## Search tokens (`.searchable(tokens:)`)

```swift
public struct SearchToken: Identifiable, Hashable { let id: String; let label: String; let term: Term }
```

| Term | Token label |
|---|---|
| `type:video` | Videos |
| `type:article` | Articles |
| `type:product` | Products |
| `is:favorite` | Favorites |
| `is:noted` | With a note |
| `is:untagged` | Untagged |
| `is:broken` | Broken links |
| `#design` | #design |
| `-#work` | Not #work |
| `created:2026-09` | Saved Sep 2026 |

- **Tokenising the field:** when the text ends with a space and its last word parses as a non-text term, move that
  term into `tokens` and remove it from the text.
- **Suggested tokens:** the type tokens, Favorites, the top 3 tags by count, and "Not #{most common tag}".
- The final query is `tokens.map(\.term) + Query(text).terms`.

## Built-in filters (Collections tab chips)

| Chip | Query |
|---|---|
| Favorites | `is:favorite` |
| Articles | `type:article` |
| Videos | `type:video` |
| Products | `type:product` |
| With a note | `is:noted` |
| Untagged | `is:untagged` |
| Duplicates | `is:duplicate` |
| Broken links | `is:broken` |
| Archived | `is:archived` |

## Test table (put all of these in `QueryLanguageTests`)

Fixture library: `docs/fixtures/library.json`.

| Query | Expect |
|---|---|
| `async` | ytrt, tokio, pin, phil, ytprod (ytprod matches through its excerpt) |
| `ASYNC` | same as above |
| `#des` | glass, verge, figma |
| `-#rust type:video` | empty (both fixture videos are tagged rust) |
| `type:video` | ytrt, ytprod |
| `is:favorite` | nasa, glass, book |
| `is:untagged` | none (every fixture link has tags); add one untagged link in the test and expect it |
| `"space suit"` | nasa |
| `space suit` | nasa (both words, any field) |
| `space match:or ramen` | nasa, water, shuttle, ramen |
| `link:youtube` | ytrt, ytprod |
| `title:Rust` | ytrt, book, ytprod, pin, phil |
| `note:artemis` | nasa |
| `created:2026-09` | every live link except nasa, ytrt, glass, tokio (saved in October) |
| `created:>2026-09-30` | nasa, ytrt, glass, tokio **and ramen**: plain string comparison means `2026-09-30T18:00…` > `2026-09-30`. This matches the web app; keep it |
| `https://nasa.gov/x` | parsed as plain text, not a field |
| `is:archived` | only archived links; without it, archived links never appear |
| `is:duplicate` | add a second copy of `https://nasa.gov/…/` (trailing slash, different case) → both match |
| `is:broken` | in-test links with httpStatus 0, 1, 404, 410 match; 403 and 503 don't (the trashed fixtures tr1/tr2 are broken but never searched) |
| `-is:favorite #rust` | rust links that aren't favourites |
| *(empty)* | all live links |
| round-trip | `Query(s).string` re-parses to an equal `Query` for every row above |
