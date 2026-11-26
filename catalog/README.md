# The Beyond Steam catalog

This folder is what the **Get more** tab shows:

- `catalog.json`: the list of themes and redesigns.
- `previews/`: a small picture for each one.
- `stats.json`: install counts, GitHub stars and the last update date.
  - A [daily job](../.github/workflows/stats.yml) refreshes it.
  - "Installs" counts downloads of the release zip that Beyond Steam installs from.

## Submitting a theme or redesign

1. **Publish it on GitHub** under a licence that allows sharing.
   - **A theme** needs a `skin.json` at the top of its repository. Themes made for Millennium work as they are.
   - **A redesign** needs a `plugin.json`; see [docs/REDESIGNS.md](../docs/REDESIGNS.md).
2. **Make a release and attach a zip** of it:
   - for a theme, `<RepositoryName>.zip`;
   - for a redesign, the zip named in your entry.

   Beyond Steam installs from `https://github.com/<owner>/<repo>/releases/latest/download/<zip>`, so new releases
   reach users as updates.
3. **Open a pull request** that adds your entry to `catalog.json` and a 480-pixel-wide preview image to `previews/`.

   ```json
   {
     "id": "MyTheme",
     "kind": "theme",
     "name": "My Theme",
     "author": "you",
     "description": "One or two sentences.",
     "version": "1.0.0",
     "repo": "you/MyTheme",
     "zip": "https://github.com/you/MyTheme/releases/latest/download/MyTheme.zip",
     "preview": "previews/MyTheme.jpg"
   }
   ```

   - `id` becomes the install folder name.
   - `version` should match your latest release, so users see the **Update** badge when it changes.

What gets listed:

- original work, or work you have the rights to;
- no impersonation of other brands;
- nothing that reads or sends personal data.

Tools made with AI assistance are welcome; please say so in your README.
