# PushFlow Terminology
## Purpose
This file defines the smallest set of terms that should stay stable across product planning, UI, and engine-facing discussion.
The goal is clarity, not exhaustiveness.
---
## Core Terms
### Project
The top-level container for one performance problem.
A project includes:
- one canonical performance timeline
- one evolving family of layout options
- one set of analysis and comparison decisions
### Sound identity
The stable user-facing mapped object.
A sound identity is what gets assigned to pads, shown in the grid, referenced in analysis, and preserved across saved states.
Imported pitch may be retained as provenance, but sound identity is the durable product term.
### Pad
A physical Push pad.
### Grid Position
A pad location on the grid, usually represented as a row and column.
### Layout
The static mapping artifact that places sound identities on grid positions.
A layout answers the question: where are the sounds placed on the grid?
### Active Layout
The committed baseline layout for the project.
This is the default layout the user is currently working from and comparing against.
### Working/Test Layout
The exploratory draft layout created by ordinary manual edits.
This is where the user experiments before saving or promoting changes.
### Saved Layout Variant
A durable saved alternative that does not replace the active baseline.
### Candidate Solution
A generated proposed layout.
A candidate solution is an alternative worth reviewing, not a hidden second project model.
### Execution Plan
The derived play-through interpretation of a specific layout state.
An execution plan is attached to a specific layout state rather than stored as free-floating truth.
### Performance Event
A time-slice or moment in the performance timeline used for local analysis.
A performance event helps explain what is happening at a given moment and why it is easy or difficult to play.
### Finger Assignment
The finger usage associated with playing a layout state at a given event or passage.
Finger assignment helps explain execution, but it is not the same thing as layout.
---
## Performance Route Terms
These terms describe the rehearsal plan of a song. They sit beside the layout terms above and never replace them.
### Performance Route
The project's authored plan of what the performer does over the song: its sections, the Push mode in each part, and which lanes the performer plays by hand.
A project has one performance route, bound to its one performance timeline and independent of which layout is active.
### Section
A named bar range of the song, with "what you do" text.
Sections tile the song from the bar holding the first note to the bar after the last note ends, with no gaps or overlaps.
Bars are counted as the position readout counts them; a section boundary is always on a bar line.
### Push mode
The mode the performer has Push 3 in: Session View, Instrument, Drum Rack, FX / Device, or Control (the button presses between modes).
### Mode span
A bar range over which one Push mode applies, or none is set ("no mode set").
Mode spans tile the song, and may start and end between bar lines.
### Arrangement lane
A track as the arrangement plays it.
A lane is a Sound group, or a Sound in no group; it holds the notes of its Sounds.
### Clip
A stretch of bars in which a lane has notes. Clips are derived from the notes, not authored.
### Performed lane
A lane the performer plays by hand rather than letting its clip play.
By default a lane is performed when one of its Sounds is placed on the Active Layout; the performance route can say otherwise per bar range (a performed span).
### Phrase and Action
Smaller parts of a section, used to zoom in: a phrase is a few bars, and an action is one bar, or the part of one in a single Push mode. Both are derived, not authored.
### Cue
The next press the performer makes, with the pad and finger the Active Layout's execution plan gives it.
---
## Short Reference Table
| Term | Meaning |
|---|---|
| `Project` | One performance problem and its associated states |
| `Sound identity` | Stable mapped object shown across the product |
| `Pad` | Physical Push pad |
| `Grid Position` | Location of a pad on the grid |
| `Layout` | Static mapping of sounds to positions |
| `Active Layout` | Current committed baseline |
| `Working/Test Layout` | Exploratory draft |
| `Saved Layout Variant` | Durable saved alternative |
| `Candidate Solution` | Generated proposal |
| `Execution Plan` | Derived play-through of a specific layout state |
| `Performance Event` | Time-slice used for local analysis |
| `Finger Assignment` | Finger usage for execution at a moment or passage |
| `Performance Route` | Authored plan of what the performer does over the song |
| `Section` | Named bar range of the song with what you do in it |
| `Push mode` / `Mode span` | Push 3 mode the performer is in, over a bar range |
| `Arrangement lane` | A Sound group, or a Sound in no group, as the arrangement plays it |
| `Clip` | Derived stretch of bars where a lane has notes |
| `Performed lane` | Lane the performer plays by hand rather than from its clip |
| `Phrase` / `Action` | Derived parts of a section for zooming in |
| `Cue` | Next press, with its pad and finger from the execution plan |
---
## Terms to Use More Carefully
These terms may still be useful, but they should not replace the core terms above in the main canon:
- hand zone
- natural hand pose
- musical role
- voice
- learnability
- expressiveness
- robustness
They are supporting concepts, not the main vocabulary spine.
