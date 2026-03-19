# PROJECT_TERMINOLOGY_TABLE

| Canonical Term | Definition | Avoid / Deprecated Alternatives | Notes |
|---|---|---|---|
| Layout | Full static assignment of musical identities to Push pads. | “Mapping” used ambiguously for everything. | Use “layout” for user-facing artifact. |
| Mapping | The relationship/data structure connecting identities to pad coordinates. | Using as synonym for final recommended solution. | A layout contains mapping data. |
| Pad | Physical Push button on the 8×8 surface. | Cell (when referring to physical location). | Always anchor to `(row,col)`. |
| Grid Position | Coordinate of a pad (`row`, `col`). | x/y without convention. | Row bottom→top, col left→right by default. |
| Cell | Optional abstract slot/index concept (if used). | Using to mean physical pad. | Only use when truly modeling slot abstractions. |
| Performance Event | Time-based trigger in the musical sequence. | “Note” for every timeline concept. | Event includes timing and dynamics context. |
| Note | MIDI pitch/event identity concept. | Using as synonym for sound role or execution action. | Keep distinct from “sound” and “role.” |
| Sound | Perceptual/timbral identity (kick, snare, stab). | “Note” when timbre is intended. | Useful for user communication. |
| Voice | Distinct mapped entity/stream tracked across sequence. | “Track” when conceptually ambiguous. | May represent note-based or role-based identity. |
| Musical Role | Functional purpose in arrangement (pulse, accent, fill, lead). | Treating all events as equal. | Can influence optimization priority. |
| Execution Plan | Full timeline of hand/finger assignments for events. | “Fingering” used ambiguously for both micro/macro. | First-class output, coupled to layout. |
| Finger Assignment | Per-event hand/finger decision. | Calling this the full execution artifact. | Building block of execution plan. |
| Feasibility | Binary/threshold physical possibility constraints. | Interchange with ergonomics/difficulty. | “Can it be done at all?” |
| Ergonomics | Comfort/strain tendency under realistic human movement. | Interchange with feasibility. | “How natural is it?” |
| Performance Difficulty | Composite burden over time from multiple factors. | Single-factor “score” as complete truth. | Must be explainable by contributing factors. |
| Natural Hand Pose | Canonical comfortable hand/finger geometry prior. | Treating as optional style preference. | Core modeling primitive. |
| Home Pose | Current reference resting position in a context/state. | Assuming always equal to natural pose. | Can drift from natural pose over time. |
| Hand Zone | Preferred left/right regions on the grid. | Hard partition assumptions without context. | Typically soft constraints with penalties. |
| Candidate Solution | A complete option: layout + execution + analysis. | “Best solution” as universal singular outcome. | Encourage multiple alternatives. |
| Robustness | Stability of playability across sections and conditions. | Local easiness mistaken for global quality. | Evaluate full-song behavior. |
| Learnability | Memorability/coherence burden for performer. | Ignoring cognitive load in favor of raw score. | Critical for real practice adoption. |
| Expressiveness | Ability to execute accents/dynamics/musical character. | Treating all pad positions as expressively equivalent. | Connects ergonomics to musical outcome. |