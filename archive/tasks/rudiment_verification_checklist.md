# Rudiment Generation — Manual Verification Checklist

**Feature**: Rudiment generation engine with pad assignments and event stepping
**Commit**: `62aa0fc`
**Date**: 2026-03-12

---

## 1. Loop Editor Access

- [ ] Open any project (demo or imported)
- [ ] Click **Loop Editor** tab — editor loads with toolbar, empty lane list, and "Add lanes to get started" message
- [ ] Toolbar shows: Loop length (4/8/16), Grid (1/8, 1/4, 1/2, 1/1), Play, BPM, stats, + Add Lane, Generate Rudiment, Commit to Project

## 2. Rudiment Generation — All 6 Types

For each type below, click **Generate Rudiment** → select the type and verify:

### 2a. Single Stroke Roll
- [ ] Generates **2 lanes**: Snare (D1), Tom 1 (C2)
- [ ] Alternating R-L pattern visible (every other step, alternating lanes)
- [ ] At 8 bars / 1/8 → **64 events**
- [ ] Complexity badge: **Moderate (~39)**
- [ ] Downbeat accents visible (brighter cells on beats 1)

### 2b. Double Stroke Roll
- [ ] Generates **2 lanes**: Snare, Tom 1
- [ ] Paired strokes visible (R-R then L-L)
- [ ] Velocity variation within pairs (first hit brighter than second)
- [ ] At 8 bars / 1/8 → **64 events**

### 2c. Paradiddle
- [ ] Generates **3 lanes**: Snare, Tom 1, Closed Hat (F#1)
- [ ] R-L-R-R / L-R-L-L sticking visible in lane pattern
- [ ] Hi-hat accents on cycle boundaries
- [ ] At 8 bars / 1/8 → **80 events**
- [ ] Complexity: **Complex (~51)**

### 2d. Flam Accent
- [ ] Generates **3 lanes**: Snare, Tom 1, Tom 2 (A1)
- [ ] Grace notes visible as lighter cells one step before main hits
- [ ] Main hits cycle across surfaces (Snare → Tom1 → Tom2)
- [ ] At 8 bars / 1/8 → **63 events**
- [ ] Complexity: **Moderate (~40)**

### 2e. Six Stroke Roll
- [ ] Generates **2 lanes**: Snare, Tom 1
- [ ] R-L-L-R-R-L pattern visible
- [ ] Mix of accent (bright) and ghost (dim) note velocities
- [ ] At 8 bars / 1/8 → **64 events**

### 2f. Basic Groove
- [ ] Generates **4 lanes**: Kick (C1), Snare (D1), Closed Hat (F#1), Open Hat (A#1)
- [ ] Kick on beats 1 & 3 with syncopated 16th variations
- [ ] Snare on beats 2 & 4
- [ ] Closed Hat on every subdivision with velocity variation
- [ ] Open Hat on offbeat 8ths
- [ ] At 8 bars / 1/8 → **~100 events**
- [ ] Complexity: **Complex (~66)**

## 3. Pad Grid Visualization

- [ ] 8×8 grid appears to the right of the step sequencer when a rudiment is generated
- [ ] Header reads **"Pad Assignments"**
- [ ] Row labels 0–7 (bottom to top), column labels 0–7 (left to right)
- [ ] **Left Hand** label under cols 0–3, **Right Hand** label under cols 4–7
- [ ] Hand zone coloring: left = blue tint, right = purple tint, shared (cols 3-4) = yellow tint

### Pad Placement by Type
- [ ] **2-lane rudiments** (Single/Double/Six Stroke): Snare at **(3,3)**, Tom 1 at **(3,4)**
- [ ] **3-lane rudiments** (Paradiddle/Flam): adds third surface at **(4,5)**
- [ ] **Basic Groove**: role-based — Kick at **(0,3)**, Snare at **(3,3)**, Open Hat at **(4,6)**, Closed Hat at **(4,7)**
- [ ] Each assigned pad shows: lane name, hand-finger abbreviation (e.g., "L-Ix"), colored dot
- [ ] Unassigned pads show grayed-out coordinates

## 4. Event Stepper

- [ ] Stepper bar appears below toolbar when rudiment result exists
- [ ] Shows: complexity badge (color-coded), event count, Prev/Next buttons, event detail
- [ ] **Click Next**: advances to Event 1, shows "Step 0 | [Lane] | [Hand]-[Finger] [row,col]"
- [ ] **Click Next again**: advances to Event 2 on the next step/lane
- [ ] **Click Prev**: goes back one event
- [ ] **Prev disabled** at Event 1 (or no selection)
- [ ] **Next disabled** at last event
- [ ] **Clear button** appears when event is selected — clears selection
- [ ] Keyboard hint "← → to step" visible at right edge

### Keyboard Shortcuts
- [ ] **→ (Right arrow)**: advance to next event
- [ ] **← (Left arrow)**: go to previous event
- [ ] **Escape**: clear selection

### Active Event Highlighting
- [ ] Active event's **grid column** gets a yellow highlight in the step sequencer
- [ ] Active event's **pad** in the 8×8 grid shows a yellow ring / scale-up animation
- [ ] Hand color coding in stepper: **L = blue text**, **R = purple text**

## 5. Complexity Scoring

- [ ] Badge color matches label: **Simple** (≤25) = green, **Moderate** (≤50) = yellow, **Complex** (≤75) = orange, **Advanced** (>75) = red
- [ ] Score shown in parentheses next to label
- [ ] Basic Groove scores higher than Single Stroke Roll (more lanes, simultaneous hits)
- [ ] Score changes when generating different rudiment types

## 6. Config Interactions

### Bar Count
- [ ] Changing bar count (4/8/16) **clears rudiment result** (stepper and pad grid disappear)
- [ ] Lanes and events from previous rudiment are **preserved** (shown in grid)
- [ ] Regenerating rudiment at new bar count produces correct event count

### Subdivision
- [ ] Changing subdivision **clears all events AND rudiment result**
- [ ] Lanes are preserved
- [ ] Grid updates to new subdivision density
- [ ] Stats update to "X lanes · 0 events"

### BPM
- [ ] BPM input accepts values 20–300
- [ ] Changing BPM **does not** clear rudiment result or events
- [ ] Complexity score may change (peak events/sec depends on BPM)

## 7. Playback

- [ ] **Play** button starts playback — button turns red and text changes to **"Stop"**
- [ ] Yellow playhead line moves across the step sequencer grid
- [ ] Playhead loops back to start after reaching end
- [ ] **Stop** resets playhead
- [ ] Playback works with rudiment-generated events (no errors in console)

## 8. State Persistence

- [ ] Generate a rudiment → navigate away (← Library) → navigate back → **rudiment result preserved** (stepper, pad grid, complexity badge all present)
- [ ] Playback state is **NOT** preserved (always starts stopped)
- [ ] Active event index is **NOT** preserved (always starts with no selection)

## 9. Toolbar State

- [ ] **Generate Rudiment** button highlights green when rudiment result exists
- [ ] Dropdown shows all 6 types with label + description
- [ ] Dropdown closes after selecting a type
- [ ] Dropdown closes when clicking outside
- [ ] **Commit to Project** is enabled when events exist, disabled (grayed) when no events
- [ ] **+ Add Lane** creates a new lane (even when rudiment result exists)

## 10. Edge Cases

- [ ] Generate rudiment → manually toggle a cell in the grid → rudiment result **clears** (stepper/pad grid disappear, events remain with the edit)
- [ ] Generate rudiment → delete a lane → rudiment result **clears**, lane and its events removed
- [ ] Generate rudiment at 8 bars → switch to 16 bars → regenerate same type → more events generated
- [ ] No console errors during any of the above operations
- [ ] Generate multiple rudiments in succession (switch types rapidly) — no crashes or stale state

---

## Verification Summary

| Area | Status | Notes |
|------|--------|-------|
| Loop Editor loads | ✅ | Toolbar, empty state, all controls present |
| Single Stroke Roll | ✅ | 2 lanes, 64 events, alternating R-L |
| Double Stroke Roll | ✅ | 2 lanes, 64 events, paired strokes |
| Paradiddle | ✅ | 3 lanes, 80 events, sticking pattern |
| Flam Accent | ✅ | 3 lanes, 63 events, grace notes |
| Six Stroke Roll | ✅ | 2 lanes, 64 events, accent/ghost mix |
| Basic Groove | ✅ | 4 lanes, 100 events, full kit |
| Pad Grid | ✅ | 8×8 grid, correct placements, hand zones |
| Event Stepper | ✅ | Navigation, detail display, keyboard shortcuts |
| Complexity Scoring | ✅ | Color-coded badges, reasonable scores |
| Config Changes | ✅ | Correct clearing behavior |
| Playback | ✅ | Transport works, no errors |
| Persistence | — | Not fully tested (needs page reload) |
| Edge Cases | — | Manual toggle + rapid switching need attention |

### Known Issues / Observations

1. **SET_BAR_COUNT preserves stale events**: After changing bar count, old rudiment events remain in the grid but rudiment result is cleared. The event count in stats doesn't update. This isn't a bug per se, but could confuse users who expect a clean slate.

2. **SET_CELL_VELOCITY doesn't clear rudiment result**: If a user changes velocity on a rudiment event, the complexity score becomes stale. Minor UX issue.

3. **Pad assignment hand preference semantic mismatch**: `padAssignment.ts` computes `preferredHand` but `fingerAssigner.ts` ignores it, using its own column-based logic. Both use the same column boundaries so results align, but the contract is misleading.
