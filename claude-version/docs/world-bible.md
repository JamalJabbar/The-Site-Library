# The Site Library World Bible

## World Contract

Travel from a suspended publisher's volume into a contemporary private archive while that same book reveals the room, enters its exact shelf slot, and turns the shelf into a usable portfolio.

Scroll controls camera, architecture, light, and global time. Pointer, touch, and keyboard control local book focus and inspection without changing the authored route.

## Art Direction

Physical scene: a brand director reviews a prospective studio on a large monitor in a quiet office, where soft daylight and a dimmer architectural interior make a warm, material-led world appropriate.

### Design Dials

| dial | value | reason |
| --- | ---: | --- |
| `DESIGN_VARIANCE` | 8 | asymmetrical campaign composition and spatial chapters |
| `MOTION_INTENSITY` | 9 | the book-to-shelf journey is the product narrative |
| `VISUAL_DENSITY` | 4 | seven volumes and architectural detail with sparse interface chrome |

### Visual Grammar

| decision | value | reason |
| --- | --- | --- |
| world units | 1 unit = 1 meter | coherent camera, fog, and light ranges |
| human reference | 1.72 units | validates shelf and room scale |
| silhouette | monolithic shelving, slim brass rails, rectangular volumes | contemporary archive instead of period library |
| bevel language | 0.5-1.5% of object width | catches light without toy-like rounding |
| corner system | square, 2-4px DOM radius | binding and architecture stay precise |
| color strategy | restrained global palette, committed colors on volumes | the collection has identity without visual noise |
| global accent | aged brass `#ad8955` | foil, progress, focus, and warm highlights only |
| lens range | 32-42 degree FOV | restrained architectural and product-photography perspective |
| camera roll | 0 degrees | architecture stays calm and credible |
| pointer parallax | book yaw +/-3 degrees, pitch +/-2 degrees | tactile response without competing with scroll |
| fog | density 0.006-0.018 | depth separation and seam control |

### Palette Roles

| role | value | use |
| --- | --- | --- |
| parchment | `#f0ece3` | hero and light DOM sections |
| paper | `#e5ded1` | page blocks, quiet surface variation |
| cream | `#f8f4eb` | readable light and fallback copy |
| ink | `#151310` | primary copy and deep neutral |
| soft ink | `#35302a` | secondary copy |
| walnut | `#281d17` | shelf structure and dark sections |
| walnut dark | `#18110e` | deep room and final table |
| brass | `#ad8955` | focus, foil, and key detail |
| volume colors | oxblood, forest, navy, charcoal, moss, clay | project identity only |

### Material Families

| material | maps and construction | physical response | budget |
| --- | --- | --- | --- |
| linen cloth | procedural 256px color, normal, and roughness textures | dielectric, roughness 0.72-0.9, normal scale 0.24 | one shared set with per-book color |
| paper block | procedural edge bands and fiber noise | dielectric, roughness 0.82, warm page color | one shared 256px texture |
| restrained foil | canvas cover graphics plus metallic material | metalness 0.9, roughness 0.32 | one material family, per-book color |
| walnut | procedural grain canvas texture | dielectric, roughness 0.54-0.72 | one shared 512px texture |
| limestone | broad color variation, no high-frequency noise | dielectric, roughness 0.88 | untextured material |
| plaster | warm neutral with subtle roughness | dielectric, roughness 0.93 | untextured material |

Color textures use sRGB. Normal and roughness textures remain linear.

## Scene Graph

```text
Scene
  WorldRoot
    Environment
      PlasterWall
      LimestoneFloor
      CeilingPlane
    LibraryArchitecture
      ShelfShell
      ShelfBays
      BrassRails
      ReadingTable
    Books
      HeroBook
      ProjectBooks[7]
    Interactives
      BookProxies[7]
    Atmosphere
      DustPoints
  InspectionRoot
  CameraRig
    PathRig
      InputRig
        PerspectiveCamera
```

One renderer, one scene, and one world remain alive from frontispiece through commission. The same hero volume moves between floating, shelf, exploded-binding, and table poses. It is never replaced by a look-alike.

## Chapter Ledger

| id | beat and landmark | spatial change | scroll weight | world state | fallback |
| --- | --- | --- | ---: | --- | --- |
| `frontispiece` | One floating Site Library volume | near-abstract parchment studio, shelf hidden in depth | 1.0 | bright key, low fog, no dust | fallback poster plus hero copy |
| `journey` | The room reveals itself around the departing book | camera dollies back, architecture and project books emerge, hero enters exact slot | 5.8 | key dims, practicals rise, fog deepens | direct chapter still and text summary |
| `selected-works` | Shelf becomes portfolio navigation | camera trucks across seven distinct volumes | 4.0 | warm shelf key, center-book foil response | accessible project cover list |
| `reading-room` | Authored service model | camera moves beyond shelf toward limestone reading table | 1.15 | diffuse warm light, low fog | semantic service catalog |
| `binding` | Process shown through construction | hero book separates into boards, spine, pages, endpaper, and foil, then reassembles | 1.7 | precise neutral product light | ordered process list |
| `studio` | Small studio, deliberate output | camera rests on quiet architectural negative space | 1.1 | parchment-biased fill, no particles | editorial studio copy |
| `commission` | Next client's empty place | hero book rests on dark table beside one open shelf slot | 1.0 | warm directional key, deep walnut ambient | final CTA and email |

## Camera Ledger

Desktop and mobile endpoints are authored independently. Coordinates are the initial graybox values and remain configuration data.

| chapter | desktop position | target | FOV | mobile position | mobile target | mobile FOV | risk |
| --- | --- | --- | ---: | --- | --- | ---: | --- |
| frontispiece | `[0, 0.25, 8.2]` | `[0, 0.25, 0]` | 35 | `[0, 0.35, 10.2]` | `[0, 0.3, 0]` | 40 | headline overlap |
| journey | `[0, 0.5, 8.8]` | `[0, 0.35, -5.6]` | 38 | `[0, 0.9, 11.6]` | `[0, 0.42, -5.6]` | 44 | shelf top crop |
| selected works | irregular slot X plus `1.15`, Y `0.32`, Z `0.2` | active slot, Z `-5.75` | 34 | irregular slot X, Y `0.55`, Z `4.25` | active slot, Z `-5.75` | 42 | tiny edge volumes |
| reading room | `[6.8, 2.1, 8.4]` | `[4.5, 0.4, -2]` | 39 | `[4.2, 2.8, 11.5]` | `[3.4, 0.8, -2]` | 46 | table blocks copy |
| binding | `[0, 0.8, 7.4]` | `[0, 0.2, 0]` | 36 | `[0, 1.35, 10.2]` | `[0, 0.3, 0]` | 43 | exploded boards clip |
| studio | `[-6.2, 2.4, 10.2]` | `[-2.2, 0.6, -2]` | 40 | `[-3.4, 3, 12.5]` | `[-2, 0.8, -2]` | 47 | empty negative space |
| commission | `[0, 3.8, 7.8]` | `[0, -0.6, 0.4]` | 34 | `[0, 4.8, 10.2]` | `[0, -0.5, 0.4]` | 41 | tabletop near-plane |

## Interaction Matrix

| id | availability | hover or focus | activation | accessible proxy | recovery |
| --- | --- | --- | --- | --- | --- |
| `project-book-*` | selected works chapter only | translate 0.05m, yaw 2 degrees, foil key +12% | open inspection state and preserve shelf pose | real button with project title | Escape or Return restores exact transform and scroll |
| `inspection-book` | project inspection only | pointer yaw +/-7 degrees, pitch +/-4 degrees, cover crack 12 degrees | external project link stays in DOM | inspection region with close and visit actions | focus returns to originating project button |
| `commission-book` | commission chapter only | cover opens 6 degrees | Commission a Site mail link | real CTA link | cover returns on blur or pointer exit |

State machine:

```text
HERO -> HERO_TO_LIBRARY -> LIBRARY
LIBRARY -> PROJECT_OPENING -> PROJECT_INSPECTION
PROJECT_INSPECTION -> PROJECT_CLOSING -> LIBRARY
LIBRARY -> READING_ROOM -> BINDING -> STUDIO -> COMMISSION
```

## Asset and Loading Ledger

| group | assets | required by | prefetch | fallback |
| --- | --- | --- | --- | --- |
| critical shell | local fonts, procedural cloth/paper/wood, hero cover canvas, first shelf bay | frontispiece | page load | generated library poster |
| shelf | seven data-driven covers, shared book geometry, full shelf architecture | stacks | journey progress 0.2 | semantic project list |
| inspection | project details and optional deferred media | selected works | centered project focus | book cover plus text |
| later chapters | reading table, exploded pose, final table | reading room | shelf progress 0.75 | semantic chapter content |

No external runtime images are required for the live 3D books. Cover, spine, and back graphics are separate deterministic canvas textures. The generated architectural poster is local and used only as fallback evidence.

## Performance Budget

```yaml
minimum_device: iPhone 12 class / integrated laptop GPU
target_fps: 60
fallback_fps: 40
critical_transfer_mobile_mb: 4.5
total_transfer_mobile_mb: 12
dpr_mobile: 1.25
dpr_tablet: 1.4
dpr_desktop: 1.75
visible_triangles_mobile: 180000
visible_triangles_desktop: 500000
draw_calls_mobile: 180
draw_calls_desktop: 180
shadowed_lights_mobile: 1
shadowed_lights_desktop: 2
```

Quality cuts occur in this order: lower DPR, remove dust, lower shadow resolution, disable secondary shadow casters, simplify architectural trim, then reduce non-focal books. Camera endpoints, hero flight, project access, and semantic content remain intact.

## Verification Gates

1. Graybox frontispiece, shelf reveal, and exact hero slot endpoint.
2. Forward and reverse journey with no scene seam or reparent jump.
3. One finished linen book under hero and shelf lighting.
4. Raycast and keyboard inspection using the same state machine.
5. Desktop, tablet, and phone camera compositions.
6. Reduced-motion and forced-WebGL-fallback paths.
7. Console, network, renderer counters, frame timing, and complete teardown.
