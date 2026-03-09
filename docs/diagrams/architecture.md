# Architecture Diagram

This project was generated with the assistance of Codex AI and prompted by Ustselemov.

```mermaid
flowchart LR
    User[User] --> UI[index.html]
    UI --> Styles[styles.css]
    UI --> Logic[app.js]
    Logic --> Canvas[HTML Canvas]
    Logic --> Assets[levels/ PNG assets]
    Canvas --> Export[PNG download]
```
