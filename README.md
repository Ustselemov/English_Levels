# Levels Composer

Project folder: `D:\VibeCoding\levels-composer`

## Structure

- `index.html` - main UI
- `styles.css` - visual design and layout
- `app.js` - composition logic and export flow
- `favicon.svg` - browser tab icon
- `levels/` - local image assets
- `exports/` - generated PNG files
- `start_levels_builder.bat` - opens the app locally

## Run

Option 1:
- Double-click `start_levels_builder.bat`

Option 2:
- Open `index.html` directly in the browser

## Current behavior

- Uses assets from `./levels`
- Builds the final image from layered PNGs
- Lets you edit levels for Listening, Pronunciation, Vocabulary, Grammar, and Fluency
- Builds a unique default export name from the current level combination
- PNG export may ask once for folder access so the browser can export trusted local files

## Notes

- The app is tuned for Windows and modern Chromium-based browsers.
- The project currently assumes one fixed layer mapping between the five learning categories and the image asset groups.
