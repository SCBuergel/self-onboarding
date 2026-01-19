# Gnosis VPN Self-Onboarding

Static, versioned onboarding wizard for Gnosis VPN. No build step, no backend.

## Run locally

Open `index.html` in a browser or serve the folder with any static server.

## Versioned content

Versions are selected by URL parameter:

```
https://<host>/index.html?v=1.1.0
```

Defaults and labels live in `content/versions.json`.

## Update workflow

1. Duplicate the latest JSON in `content/`.
2. Update the `version` and steps.
3. Add the new version to `content/versions.json`.
4. Commit and deploy.
