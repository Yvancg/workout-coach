# Third-Party Notices

Project license: GNU GPLv3.

## Exercise reference media

The application currently ships only the project-generated SVG exercise reference cards in:

`public/exercise-reference/`

No imported GIF/WebP exercise media is part of the runtime repository after the October 2026 cleanup.

Previously committed imported exercise files were removed because their manifest did not contain verifiable source URLs or redistribution terms.

Do not add third-party exercise media to `public/` unless all of the following are recorded first:

- exact source URL or dataset identifier
- applicable license/terms
- redistribution permission for the public repository and deployed application
- required attribution text

## Embedded video

Workout Coach embeds warmup and cooldown videos hosted by YouTube. The video files are not copied into this repository; playback remains hosted by YouTube.

## Software dependencies

Runtime and development dependencies are declared in `package.json` and locked in `package-lock.json`. Each dependency remains subject to its own license terms.
