# Gnosis VPN Self-Onboarding

Static, versioned onboarding wizard for Gnosis VPN. No build step, no backend.

## System overview

This is a pure static SPA that loads JSON content per version and renders a
linear onboarding flow in the browser. The UI is defined by HTML/CSS, while
`app.js` (and `with-form.js` for the summary variant) handles version selection,
step navigation, and optional help video embedding. Content changes are made by
editing JSON files in `content/` and linking them in `content/versions.json`.

## Run locally

Use the minimal static server on port 8080:

```
node server.js
```

Then open:

```
http://localhost:8080/index.html
```

## Versioned content

Versions are selected by URL parameter:

```
https://<host>/index.html?v=1.1.0
```

Defaults and labels live in `content/versions.json`.

## Frontend variants

- `index.html` + `style.css`: minimal black/white baseline theme.
- `fancy.html` + `fancy.css`: elegant rounded styling, still monochrome.
- `crazy.html` + `crazy.css`: rainbow, maximal styling.
- `with-form.html` + `fancy.css` + `with-form.js`: wizard flow with a
  submission summary and feedback form at the end.

## Update workflow

1. Duplicate the latest JSON in `content/`.
2. Update the `version` and steps.
3. Add the new version to `content/versions.json`.
4. Commit and deploy.
