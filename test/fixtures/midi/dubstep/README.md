# Dubstep test suite

Realistic dubstep performances, 130–150 BPM, for testing the optimization engine on
material a Push player would actually perform. Every file is cut from one of three
arrangements written in [`arrangements.mjs`](arrangements.mjs), the single source of
truth. Edit a pattern there, then regenerate:

```bash
node scripts/generate-dubstep-midi.mjs --stats
```

`test/import/dubstepFixtures.test.ts` fails if a committed file drifts from its source.

## Sounds

One Sound per MIDI track; PushFlow names each Sound after its track. Pitches only
trigger the sample, Drum Rack style from C1, and never decide placement.

| Family | Sounds (MIDI note) |
| --- | --- |
| Drums (≤6) | Kick 36, Snare 37, Closed Hat 38, Open Hat 39, Crash 40, Fill 41 (tom/perc for fills) |
| Bass (6) | Sub 42, Wobble 43, Growl 44, Reese 45, Yoi 46, Screech 47 |
| Melodic (4–6) | four chord stabs named for the key on 48–51 (i, VI, III, VII), Pluck or Bell 52, Vox Chop 53 |
| FX (2) | Riser 54, Impact 55 |

## Arrangements

All 4/4, in 8-bar phrases, intros and outros condensed. Drops are 16 bars of 4-bar
phrases (three bars of call, a turnaround in bar 4), a crash at the top of each 8 (each
4 in Tearout), and a bigger fill at the end of bars 8 and 16.

**Deep 130** (`deep130`, F minor, 20 Sounds, 88 bars, 2:43). UK deep dubstep: 16ths
swung to 58%, kicks that skip, wobbles on 8th triplets against the straight grid.

| Bars | Section | Rhythm |
| --- | --- | --- |
| 1–8 | Intro | Syncopated pluck riff, long Fm–Db–Ab–Eb stabs, a dub vox at the end of each 4 |
| 9–16 | Intro (hats in) | Shuffled hats with ghosts, rim-style snare on 3, sub under each chord |
| 17–24 | Build | Kit drops out; snare roll in quarters, 8ths, 8th triplets, swung 16ths; 8-bar riser |
| 25–40 | Drop 1 | Kick on 1, then the "and" of 1 and the swung "e" of 4; wobble triplets, stab skanks |
| 41–48 | Breakdown | Pluck becomes a swung 16th arpeggio; vox answers |
| 49–56 | Breakdown (drums in) | Kick on 1, snare on 3, hats; sub sits out |
| 57–64 | Build 2 | As Build, vox stutter in the last bar |
| 65–80 | Drop 2 | 2-step kicks, swung 16th hats, offbeat stabs, growl/reese call and response, triplet wobble runs |
| 81–88 | Outro | Pluck, stabs and hats thin out to a final Fm chord, sub and crash |

**Halftime 140** (`halftime140`, G minor, 19 Sounds, 88 bars, 2:31). Classic half-time
and brostep: kick on 1, snare on 3, the mid-bass answering the drums in the gaps.

| Bars | Section | Rhythm |
| --- | --- | --- |
| 1–8 | Intro | Tresillo (3+3+2) stabs over Gm–Eb–Bb–F |
| 9–16 | Intro (drums in) | 8th hats and kick on 1, snare on 3 from bar 13, a tom fill |
| 17–24 | Build | Snare roll: quarters, 8ths, 16ths, 16th triplets, then 32nds for two beats and a silent half bar; kick quarters then 8ths; riser |
| 25–40 | Drop 1 | Growls before the snare, screech and yoi after it, an 8th-note wobble turnaround |
| 41–48 | Breakdown | Stab riff, sub and reese swells, vox phrase |
| 49–56 | Breakdown (drums in) | Half-time kit under the riff |
| 57–64 | Build 2 | As Build, with a vox stutter in the gap before the drop |
| 65–80 | Drop 2 | Triplet bounce: kick, hats and bass on 8th triplets, 16th-triplet growl/screech stutters, snare/tom triplet rolls |
| 81–88 | Outro | Half-time kit and stabs, ending on Gm with sub, crash and impact |

**Tearout 150** (`tearout150`, E minor, 17 Sounds, 72 bars, 1:55). Tearout and riddim:
no open hat, straight timing, a bass one-shot change nearly every 16th.

| Bars | Section | Rhythm |
| --- | --- | --- |
| 1–8 | Intro | Bell riff, Em–C stabs, hats from bar 5 |
| 9–16 | Build | Kick quarters, 8ths, then a bar of machine-gun 16ths; snare moves from backbeat to offbeats to a 16th-triplet burst |
| 17–32 | Drop 1 | Double kicks, crash every 4 bars, growl/screech/reese switching on 16ths, snare/tom interleaved fills |
| 33–40 | Breakdown | Bell and long stabs, kit returns at bar 37 |
| 41–48 | Build 2 | As Build, vox stutter at the end |
| 49–64 | Drop 2 | Riddim: everything on 8th triplets, triplet bursts on one one-shot, 16th-triplet growl/screech alternation |
| 65–72 | Outro | Kit and bell, ending on Em with sub, crash and impact |

## Files

Tiers run from simple to complex: if a tier-1 file fails, don't trust tier 3.

| File | Cut | What it stresses |
| --- | --- | --- |
| `1-elements/drums-130-shuffle.mid` | Deep Drop 1, bars 1–8, drums | Swung hats with ghost notes, skipping kicks |
| `1-elements/drums-140-halftime.mid` | Halftime Drop 1, bars 1–8, drums | The core half-time groove, 6 drums, a tom fill |
| `1-elements/drums-150-tearout.mid` | Tearout Drop 1, bars 1–8, drums | Double kicks, interleaved snare/tom 16ths at 150 |
| `1-elements/bass-140-call-response.mid` | Halftime Drop 1, bars 1–8, bass | Switching between 6 bass one-shots |
| `1-elements/bass-150-riddim-triplets.mid` | Tearout Drop 2, bars 1–8, bass | Triplet bursts on one Sound, 16th-triplet alternation |
| `1-elements/melodic-130-breakdown.mid` | Deep Breakdown, melodic | Chord changes every 2 bars under a swung 16th arpeggio |
| `1-elements/melodic-150-intro.mid` | Tearout Intro, melodic | 4 melodic hits, syncopated bell riff |
| `2-sections/build-140.mid` | Halftime Build | One Sound repeating at 16th, 16th-triplet and 32nd rates |
| `2-sections/build-into-drop-150.mid` | Tearout Build bar 5 to Drop 1 bar 4 | Machine-gun kick into a 5-note drop downbeat |
| `2-sections/drop-130-deep.mid` | Deep Drop 1, bars 1–8 | 16 Sounds, triplets against a swung grid |
| `2-sections/drop-140-halftime.mid` | Halftime Drop 1, bars 1–8 | Drums and bass call and response |
| `2-sections/drop-140-triplets.mid` | Halftime Drop 2, bars 1–8 | Mixed triplet grids |
| `2-sections/drop-150-tearout.mid` | Tearout Drop 1, bars 1–8 | The densest 16th passages at the fastest tempo |
| `2-sections/drop-150-riddim.mid` | Tearout Drop 2, bars 1–8 | Triplet riddim bass with drums |
| `2-sections/drop-140-humanized.mid` | Halftime Drop 1, bars 1–8, humanized | Played timing (±10 ms) and velocity: chords spread over a few ms must still group into one moment |
| `3-songs/song-130-deep.mid` | Deep 130, whole song | 20 Sounds over 1,412 events |
| `3-songs/song-140-halftime.mid` | Halftime 140, whole song | 19 Sounds over 1,185 events |
| `3-songs/song-150-tearout.mid` | Tearout 150, whole song | 17 Sounds over 1,114 events |

## Playing it on Push

Most of this is what a finger drummer plays live: never more than five pads at once
(the drop downbeat: kick, crash, sub, growl, impact), 16ths split across two hands. The
fastest single-Sound repeats (the 32nd snare roll at 140, the machine-gun kick at 150)
are what a player would hand to Note Repeat; as notes they test the engine's rapid
same-finger repetition cost, not its feasibility.
