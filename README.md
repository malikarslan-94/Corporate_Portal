# PRFS website deployment

This repository is configured to publish the contents of `docs/` as a static
website on Vercel. No portal application build or dependency installation is
required for this documentation site.

## One-time setup

1. Create a GitHub repository and push this project to it.
2. In Vercel, choose **Add New > Project** and import that GitHub repository.
3. Keep the project **Root Directory** set to the repository root (`./`).
4. Vercel will read `vercel.json`; confirm that the framework is **Other** and
   the output directory is `docs`.
5. Select **Deploy**.

The generated Vercel domain opens `docs/user-management-prfs.html` at `/`.
The document is also available at `/user-management-prfs`.

## Automatic publishing

- Pushes to Vercel's production branch (normally `main`) are deployed live.
- Pushes to any other branch receive a Vercel preview URL.
- Updating `docs/user-management-prfs.html` and pushing the commit updates the
  live document automatically.
- A new flow can be added as `docs/example-flow.html`; after pushing it, its
  clean URL is `/example-flow`.

There is no separate GitHub Actions workflow to maintain. The GitHub–Vercel
integration performs the deployment automatically.
