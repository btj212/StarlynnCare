# Cleanup approval list

Nothing in this list has been deleted. Do not delete a row until it is explicitly approved. Cursor is open, so the Electron caches are not safe to clear yet.

## Preserve

- Chat transcript JSONL files under `~/.cursor/projects/**/agent-transcripts/**/*.jsonl` (about 0.12 GB, 558 files). The hook sidecars are separate files and are not these transcripts.
- Canvases, assets, AgentStores, and workspace databases.
- `/Users/blakejones/Developer/StarlynnCare`, including its uncommitted California runner fix.
- `/Users/blakejones/Documents/coding-projects 2/StarlynnCare` while `com.starlynncare.pdf-archive` is still copying it. This is the PDF source. It is about 47 GB and is not eligible for deletion until a completed archive, a remote count and size check, and `rclone check` all succeed, and then only with a separate approval.

## Safe only after Cursor is fully quit

These are regenerable Electron caches, about 70 MB:

| Path | Size |
| --- | --- |
| `~/Library/Application Support/Cursor/CachedData` | 66 MB |
| `~/Library/Application Support/Cursor/Cache` | 2.4 MB |
| `~/Library/Application Support/Cursor/GPUCache` | 1.6 MB |
| `~/Library/Application Support/Cursor/Code Cache` | 24 KB |

## Do not delete until Cursor’s own cleanup has run

Run `Developer: Delete Old Chats…`, then `Developer: GC Agent KV Blobs`, from the command palette. Only after that, and only after backing up one old workspace and testing removal there, consider the undocumented hook sidecars.

The sidecars are 1,181 `*.xhawk-hooks.jsonl` files totaling 8.87 GB. The largest are:

| File | Size |
| --- | --- |
| `.../StarlynnCare/agent-transcripts/b83d321f-0f1a-4e78-a657-c9cb298f7361.xhawk-hooks.jsonl` | 2,688.5 MB |
| `.../agencyproducer/agent-transcripts/4eb69743-0dfb-488b-b9c5-384a327c341b.xhawk-hooks.jsonl` | 1,249.7 MB |
| `.../StarlynnCare-recovered/agent-transcripts/e03ec504-4b02-4c57-8341-3e6bd21ee273.xhawk-hooks.jsonl` | 1,096.6 MB |
| `.../agencyproducer/agent-transcripts/5b41137d-090f-4b10-a17d-4aa20ef35cab.xhawk-hooks.jsonl` | 873.1 MB |
| `.../StarlynnCare/agent-transcripts/6a3e13a6-ca4f-4e7d-ba87-7be3e347efe8.xhawk-hooks.jsonl` | 598.5 MB |

Old workspace folders that are mostly those sidecars:

| Folder | Size |
| --- | --- |
| `~/.cursor/projects/Users-blakejones-Documents-coding-projects-StarlynnCare` | 4.4 GB |
| `~/.cursor/projects/Users-blakejones-Documents-coding-projects-agencyproducer` | 3.3 GB |
| `~/.cursor/projects/Users-blakejones-Documents-coding-projects-StarlynnCare-recovered` | 1.2 GB |

## Eligible after you approve, and not before the PDF archive is verified

| Path | Size | Why it can go |
| --- | --- | --- |
| `/Users/blakejones/Developer/StarlynnCare/StarlynnCare-recovered` | 645 MB | Nested duplicate of the canonical checkout. Removing it also lets the temporary `tsconfig.json` exclude be reverted. |
| `/Users/blakejones/Documents/coding-projects/StarlynnCare` | 84 KB | Hollowed earlier checkout, not the PDF source. |
| Canonical `.next` | 76 MB | Regenerable build output. Do not remove it while a local build is in use. |

`node_modules` in the canonical checkout is 525 MB and is in use. Do not delete it.

The 47 GB PDF source stays off this table until remote verification succeeds.
