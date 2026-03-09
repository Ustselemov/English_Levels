# Architectural Decisions

This project was generated with the assistance of Codex AI and prompted by Ustselemov.

- Static architecture was chosen to avoid backend complexity.
- PNG layers were kept in the repository so the app works directly from static hosting.
- Export uses canvas in hosted mode and falls back to trusted local files only for `file://` usage.
- Documentation was kept concise but complete enough for public maintenance.
