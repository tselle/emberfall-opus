# Emberfall: The Emberwild Saga

A party-based fantasy RPG that runs entirely in the browser, in the spirit of a late-1980s first-person computer
role-playing game: first-person towns and dungeons, an overland map, turn-based tactical combat, and second-edition-style
rules. The setting, characters, adventures, text and art are original. Every texture, portrait, monster figure and map is
drawn by code when the page starts; there are no image or sound files.

## Play

Open `index.html` in a browser. There is nothing to install and no build step. The folder also works from a subfolder
(for example `http://host/project1/`), because every path is relative.

Start with **New company** (you roll and build your adventurers) or **Ready-made company**. Walk into the town gate to set
out into the wilds; walk into the cellar stairs to go underground.

## What is in the build

| Area | Status |
| --- | --- |
| Rules | Six abilities, six races, six classes with alignments and race and class limits; THAC0 and descending armour class; five saving-throw categories; experience tables to level 20 with a prime-requisite bonus; training at the hall at 100 gp per level gained; fighter weapon specialization; thief skills; demi-human movement at 85% of human; spell slots to level 20 (mages to circle 9, clerics to circle 7); spellbooks copied from scrolls. |
| Monsters | 347 kinds written for this game, each with hit dice, armour class, one or more attacks, morale, a treasure type and habitat. Special abilities: poison, paralysis, level drain, regeneration, breath, undead (turnable, and immune to sleep and hold), plain weapons deal half damage, swarm. |
| Spells | 75 spells (45 for mages, circles 1–9; 30 for clerics, circles 1–7) with ranges and areas, saving throws and durations. Kinds include missiles, rays, area damage, sleep, hold, charm, slay, weaken, slow, fear, healing, party healing, shields and blessings, and utility spells cast out of combat (detect traps, find doors, scrying, recall, restore, raise). |
| Items and treasure | 317 items: weapons (mundane and magic), armour and shields, potions, scrolls, wands, staves, rings, amulets, magic items, gear, keys, gems and jewellery, plus a scroll for each mage spell. Treasure types a–i roll coins, gems, jewellery and magic items. Shops stock goods by level band. |
| Combat | Isometric field, initiative, movement, melee, missiles, spells, backstab, turning undead, potions, morale and fleeing, auto-fight. Monsters in the first-person view are drawn as sprites, hidden behind walls. Loot lies where a monster fell until the company picks it up. |
| Adventures | Four hand-set stories: E0 *The Cellars of Thornwick* (levels 1–2) and E1 *The Hollow Vaults*, E2 *Barrow of the Iron King*, E3 *The Witch-Queen of Ravenmoor*. Each has a home town, levels, quests and a final enemy. Fifty generated adventures (G1-1 to G5-10: ten per level band, four small, three medium, two large, one huge). |
| Generation | Deterministic, from named random streams, so every load is identical and new features never shift existing content. Every dungeon level has 1–3 secret doors (each hides a treasure alcove) and 2–3 traps, locked doors have their keys on the same level, and a validator checks that every square is reachable. |
| Wilds | Every adventure has its own overland map: roads, a river and bridges, fatigue, time of day, sites (gate, hamlet, holy stones, cellar entrance, lair, safe camp), encounter tables, rumours and friendly travellers. |
| Quests | Commissions are kept in a journal with dated notes. Quest experience is a quarter of the listed figure; gold is paid in full. Holy sites give a small separate experience award. |
| Campaign | The campaign screen (from the menu) moves the company to any adventure's town, costs a little gold for the road, and warns when the company is under-levelled. |
| Interface | Keys: W/A/S/D and arrows to move and turn, Q/E sidestep, F search, K disarm, L listen at a door, R camp, M full map, P pack, J journal, B bestiary, 1–6 character sheets, Esc menu. A command bar, swipes, and an on-screen movement pad (on by default on touch screens; toggle in the menu). Six save slots and an autosave, in localStorage. |
| Bestiary | Fills in as monsters are met, fought and slain. |
| Screens | Phones and tablets in both orientations: the layout stacks in portrait. |

### Where the build differs from the brief

- **E1 to E3 are built by the generator.** Their names, towns, quests, final enemies and story text are written by hand,
  but their dungeon layouts come from the same generator as the fifty generated adventures, not from hand-drawn maps.
- **The monster list has 347 entries and the item list 317,** including the 45 mage spell scrolls. Some monster entries and
  many magic items are written as short descriptions with their stats; the abilities are implemented, but a few
  item effects (for example the potions of giant strength or water breathing) are flavour only for now.
- **Rings and amulets are carried, sold and given value,** but do not yet change the characters (there are no ring slots).
- **Combat is simplified in places:** each monster either moves or attacks in a turn (several attacks are rolled in one
  attack turn); saving throws against monster spells use a single formula; undead turning uses one difficulty table.
- **Testing is in headless Chrome only.** The layout is checked at 500 pixels wide (the smallest width that headless Chrome
  allows) and at desktop widths. Frame rate on a 7th-generation iPad and on Safari has not been measured.

## Layout

| File | Concern |
| --- | --- |
| `index.html`, `style.css` | The page and the one stylesheet |
| `rules.js` | Abilities, races, classes, saves, experience, THAC0, skills, spell slots, characters |
| `data.js` | Items (317 including the mage spell scrolls), trap kinds, shop stock, names, the pregenerated company |
| `modules.js` | Seeded random streams, dice notation, DOM and storage helpers |
| `monsters.js` | The monster list (347) and spawning |
| `spells.js` | The spell list (75) and out-of-combat effects |
| `treasure.js` | Treasure types a–i and hoards |
| `wilds.js` | Overland maps, terrain, sites, encounter tables and rumours, per adventure |
| `generate.js` | The adventure generator: dungeon levels, towns, wilds and the fifty generated adventures |
| `adventures.js` | The hand-set adventures E0–E3 and the registry of all adventures |
| `figures.js` | Every texture and portrait, drawn by code |
| `view3d.js` | The first-person raycaster (320×200) and monster sprites |
| `map.js` | The minimap and the full-page map |
| `watch.js` | The game clock |
| `ui.js` | Screens, the company panel, sheets, town services, menus, keys and touch |
| `combat.js` | Tactical combat on the isometric field |
| `overland.js` | Travel across the wilds, sites, camping and the overland screen |
| `journal.js` | Commissions, rewards and dated notes |
| `bestiary.js` | The bestiary |
| `campaign.js` | The campaign screen and travel between adventures |
| `navpad.js` | The on-screen movement pad for touch screens |
| `game.js` | State, movement, events, traps, searching, camping, loot, saves and the main loop |

## Checks

```
node tools/validate.js           # content: maps, links, secret doors, traps, keys, monsters, groups, spells, items,
                                 # treasure, wilds and quests for every adventure (all 54)
python3 tools/make_tests.py      # rebuilds the browser test pages (tools/run-*.html) from index.html and tools/tests/*.js
```

Open a page in headless Chrome to run its checks, for example
`google-chrome --headless=new --virtual-time-budget=900000 --dump-dom tools/run-phase4to7.html`. The pages are:

- `run-playtest.html` — phases 1 and 2: 24 checks (movement, bumps, stairs, search, camping, saves, an encounter from the map, rules)
- `run-combat.html` — four complete auto-fought battles: 16 checks
- `run-phase3.html` — the wilds, Millbrook, commissions, the barred brewery, the lair, the second cellar and a save: 17 checks
- `run-phase4to7.html` — content counts, treasure, the campaign, a generated adventure, utility spells, a fight recorded in the bestiary, and the touch pad: 22 checks

Every test page uses a requestAnimationFrame shim, because headless virtual time does not run animation frames. The shim
is only in the test pages.

## Licence

MIT. See `LICENSE`.
