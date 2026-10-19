# Architecture

17-buddy separates desktop integration from presentation. Electron's main
process observes Arena and prepares rated draft data; the Svelte renderer
receives that data through a narrow preload API and draws the badges.

## Component overview

```mermaid
flowchart LR
    subgraph External[External systems]
        Arena[MTG Arena]
        Log[(Player.log)]
        OS[macOS / Windows window system]
    end

    subgraph Main[Electron main process · src/main]
        Watcher[ArenaLogWatcher]
        Parser[Arena log parser]
        Coordinator[main.ts]
        Ratings[RatingsRepository]
        Foreground[ArenaForegroundMonitor]
        Overlay[Transparent BrowserWindow]
    end

    Data[(Embedded card-data/*.json)]

    subgraph Bridge[Preload and IPC]
        Preload[window.draftOverlay]
    end

    subgraph Renderer[Svelte renderer · src/renderer]
        App[App.svelte]
        Layout[Arena card layout]
        Badges[GradeOverlay and CardGradeBadge]
    end

    Arena --> Log
    Log --> Watcher
    Watcher --> Parser
    Parser --> Coordinator
    Data --> Ratings
    Coordinator --> Ratings
    Ratings --> Coordinator
    Coordinator -->|draft:pack-rated| Preload
    Preload --> App
    App --> Layout
    Layout --> Badges
    OS --> Foreground
    Foreground --> Coordinator
    Coordinator --> Overlay
    Overlay -. hosts .-> Renderer
```

The main process is the coordinator. It keeps Arena-specific log and window
behavior out of Svelte. The preload script exposes only `onPackRated`, so the
renderer has no direct Node.js or Electron access.

## Pack processing sequence

```mermaid
sequenceDiagram
    participant Arena as MTG Arena
    participant Log as Player.log
    participant Watcher as ArenaLogWatcher
    participant Parser as ArenaLogParser
    participant Main as Electron main
    participant Ratings as RatingsRepository
    participant Preload as Preload bridge
    participant UI as Svelte renderer

    Arena->>Log: Append BotDraft pack payload
    Watcher->>Log: Read bytes appended after startup
    Log-->>Watcher: Complete log lines
    Watcher->>Parser: parseArenaLogLine(line)
    Parser-->>Main: PackReceived
    Main->>Ratings: ratePack(pack)
    Ratings-->>Main: RatedPack
    Main->>Preload: IPC draft:pack-rated
    Preload->>UI: onPackRated(ratedPack)
    UI->>UI: Sort cards like Arena
    UI->>UI: Scale positions and render badges
```

The watcher starts at the end of the existing file, so historical draft events
are ignored. It reads only content produced while 17-buddy is running and
resets safely if Arena replaces or truncates the log.

## Overlay tracking sequence

```mermaid
sequenceDiagram
    participant OS as Window system
    participant Monitor as ArenaForegroundMonitor
    participant Main as Electron main
    participant Overlay as Overlay BrowserWindow
    participant UI as Svelte renderer

    loop Every 100 ms
        Monitor->>OS: Read active window
        OS-->>Monitor: Application and bounds
        Monitor->>Main: ArenaWindow or null
        alt Arena is active
            Main->>Main: Normalize platform bounds
            Main->>Overlay: setBounds(...) and showInactive()
            Overlay-->>UI: Viewport dimensions change
            UI->>UI: Fit 1728 × 1117 reference layout
        else Another application is active
            Main->>Overlay: hide()
        end
    end
```

Windows physical coordinates are converted to Electron device-independent
pixels. macOS fullscreen bounds are normalized when the system reports only a
top inset. Svelte does not know where Arena is; it reacts only to the size of
its own overlay viewport.

## Card-data generation

```mermaid
flowchart LR
    PublicData[17Lands public game-data CSV]
    ManualData[Manually exported Card Data CSV]
    CardList[Official 17Lands cards.csv]
    PublicBuilder[build_card_win_rates.py]
    FallbackBuilder[build_card_win_rates_from_ui.py]
    Normalize[Calculate all-decks and deck-color GIH WR grades]
    Json[(card-data/SET.json)]
    Bundle[Vite main-process bundle]
    Repository[RatingsRepository]

    PublicData --> PublicBuilder
    ManualData --> FallbackBuilder
    CardList --> PublicBuilder
    CardList --> FallbackBuilder
    PublicBuilder --> Normalize
    FallbackBuilder --> Normalize
    Normalize --> Json
    Json --> Bundle
    Bundle --> Repository
```

Raw CSV files remain local under the ignored `raw-card-data/` directory. The
tracked JSON contains only the runtime card fields required by the overlay.
