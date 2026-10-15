# Corporate Portal PRFS

Static web documentation for the Yoowifi Corporate Portal flows.

## Vercel setup

1. Open [Vercel's new project page](https://vercel.com/new).
2. Import `malikarslan-94/Corporate_Portal` from GitHub.
3. Keep the **Root Directory** set to the repository root (`./`).
4. Confirm **Framework Preset** is `Other` and **Output Directory** is `docs`.
5. Select **Deploy**.

The generated Vercel domain opens the main PRFS document at `/`. The same
document is also available at `/user-management-prfs`.

## Automatic publishing

- Every push to `main` creates a production deployment.
- Pushes to other branches create preview deployments.
- Update `docs/user-management-prfs.html` and push the commit to update the
  live document.
- Add a flow as `docs/example-flow.html` to publish it at `/example-flow`.

Vercel reads `vercel.json`, skips dependency installation and application
builds, and publishes only the files in `docs/`.
