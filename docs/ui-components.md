# UI component tools

Aceternity uses the shadcn registry and MCP server:
https://ui.aceternity.com/installation

The registry is configured in root `components.json`. Claude Code reads the
project's `.mcp.json`. Codex's `shadcn` server is registered in this computer's
user settings and explicitly targets the ScaleSquad folder. Open `scalesquad`
as the Claude Code project, install the root npm dependencies, then restart the
clients. Both run the existing pinned shadcn dependency directly through Node,
without downloading another CLI or adding a package.

To register Codex again after moving the checkout, run this from its new folder:

```powershell
codex mcp add shadcn -- node "$PWD/node_modules/shadcn/dist/index.js" mcp --cwd "$PWD"
```

Use Claude Code's `/mcp` or Codex's MCP server list to check connection after
restarting. Configuration alone does not hot-load tools into an existing chat.
The server's startup and project-registry discovery were checked directly through MCP.

Component rules:

- Use Lucide icons only. Replace any other icon imports in registry examples.
- Use the shared `src/styles/palette.ts` colors through semantic tokens.
- Keep the Next.js/MVC structure and tests under root `tests/`.
- Review component code and dependencies before installation. Do not overwrite
  existing shared components or add dependencies without the owner's approval.
- Respect reduced motion; keep login fields and validation usable while motion runs.

The approved animated login is implemented in `LoginForm`, `LoginSubmitButton`,
`AuthRoleCards` and scoped `login.module.css`. It uses native CSS transitions
and Lucide icons, with no additional animation dependency. Glass stays on
buttons, the badge and role cards; form fields and the page background stay matte.

## Public home — Incident Brief

`src/features/landing` implements the selected public home design. Headline
reveals, the cobalt underline, action shine, card hover and the mission scan use
CSS and the existing Lucide library. Panels remain matte; glass accents stay on
the main actions and mission chip. Every color references the shared palette's
semantic tokens. Layouts stack down to 320px.
The public home does not show an install prompt; offline/update handling and
install guidance on the other app screens remain available.

`LandingAction` uses Next's link pending state with a fixed icon slot, so its
loader does not move the label. `MissionPreview` is a short, scripted explanation
of the game; it is independent of the real simulator and private clues. Reduced
motion stops autoplay and offers a Next scene button. Its timers clear on pause
and unmount.

## Browser-extension hydration warnings

Extra attributes such as `bis_skin_checked`, `bis_register` and `__processed_*`
in a hydration diff come from a browser extension modifying the page before
React starts. They are absent from the app's source and clean browser responses.
Disable the injecting extension for local development and reload, or verify in
an extension-free browser. The supplied extension identifier points to Urban VPN.
The React DevTools console hook in the stack is where the warning is printed.
No blanket hydration suppression or client-only page rendering is used.
