# Third-Party Notices

Project license:
- this repository is distributed under the GNU GPLv3

## Exercise Reference Assets

This project is being prepared to support locally cached exercise reference media derived from the official ExerciseDB media source for the exact exercises used in this app.

Current state:
- `public/exercise-reference/` contains locally generated placeholder reference cards created for this project.
- No third-party ExerciseDB-derived media files are currently committed in this repository.

Before importing real ExerciseDB-derived assets into this repository, verify:
- the exact official ExerciseDB source URL being used for each imported asset
- the applicable license and reuse terms for the media assets
- whether attribution or additional notice text is required
- whether redistribution in a public Git repository is allowed

If real ExerciseDB-derived assets are later added, update this file with:
- source URLs or dataset identifiers
- license/terms summary
- attribution text if required
- the local directory where imported assets are stored

Selected workflow:
- import only app-scoped exercise images for movements actually used in this project
- stage source URLs in `scripts/exercise-asset-manifest.json`
- download assets into `public/exercise-reference/imported/`
- the app will prefer imported files automatically when present and fall back to local placeholders otherwise
- keep placeholder cards until the imported files and notice text are verified
