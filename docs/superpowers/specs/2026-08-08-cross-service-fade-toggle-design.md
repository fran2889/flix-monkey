# Cross-service fade-toggle design

## Goal

Provide a consistent manual fade override on Netflix, HBO Max, and Disney+ while respecting each service's native card interaction model.

## Surface model

`showFadeToggle` means that a discovered surface is the appropriate place to present the manual fade override. It is independent of whether that surface itself can be faded.

| Service and surface                                | `fadeable` | `showFadeToggle` |
| -------------------------------------------------- | ---------: | ---------------: |
| Netflix browse, search, progress, and ranked cards |        yes |               no |
| Netflix mini preview                               |         no |              yes |
| HBO Max fadeable tiles                             |        yes |              yes |
| Disney+ fadeable shelf and Continue Watching cards |        yes |              yes |

Netflix cards must not show the toggle because Netflix immediately replaces a hovered or focused thumbnail with its mini preview. The mini preview remains the sole Netflix fade-control surface.

HBO Max and Disney+ have no comparable hover preview. Their fadeable cards are therefore the appropriate control surface.

## Presentation and interaction

The existing `enableFadeToggle` setting remains the user opt-in. When it is disabled, no toggle is rendered.

For a surface with `showFadeToggle: true`, render the fade toggle as a neutral overlay element and visually hide it by default. Reveal it when that same surface is hovered. The hidden state uses opacity, disabled pointer events, and unchanged layout so the rating badge does not move when the toggle appears.

The toggle continues to cycle through Auto, Always, Never, and back to Auto. Clicking it prevents propagation to the streaming service's card action, persists the override, updates the toggle state, and applies the resulting fade state to every currently rendered card with the same title key.

## Scope and verification

No service-specific toggle-rendering branch is introduced beyond surface definitions. The shared app and renderer continue to use `showFadeToggle`.

Unit coverage should verify the hidden and revealed CSS behavior, and that the HBO Max and Disney+ surface definitions expose `showFadeToggle`. Existing Netflix mini-preview tests should continue to verify that Netflix exposes the control only there.
