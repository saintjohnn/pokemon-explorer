# VS Code: Vercel JSON schema

Both `frontend/vercel.json` and `backend/vercel.json` reference Vercel's published schema:

`https://openapi.vercel.sh/vercel.json`

The schema URL is documented by Vercel in its [Project Configuration reference](https://vercel.com/docs/project-configuration/vercel-json). The schema is hosted on `openapi.vercel.sh`, a Vercel-controlled domain.

The workspace setting in `.vscode/settings.json` allows the VS Code JSON language service to download schemas and trusts only the `https://openapi.vercel.sh` origin. This is narrower than trusting every domain. It affects editor validation and IntelliSense only; it does not change Vercel deployment behavior.

If VS Code still reports that the schema is untrusted:

1. Open the repository folder in VS Code (so workspace settings are loaded).
2. Open either `frontend/vercel.json` or `backend/vercel.json`.
3. Hover the schema warning and use the **Configure Trusted Domains** quick fix if it is offered; trust only `https://openapi.vercel.sh`.
4. Confirm `json.schemaDownload.enable` is `true` and reload the VS Code window.

The official schema URL can be checked at <https://openapi.vercel.sh/vercel.json> and the Vercel configuration documentation at <https://vercel.com/docs/project-configuration/vercel-json>.
