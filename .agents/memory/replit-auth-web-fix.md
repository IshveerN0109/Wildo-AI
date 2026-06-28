---
name: replit-auth-web lib fix
description: Required tsconfig settings and import.meta.env workaround for the replit-auth-web composite lib
---

# replit-auth-web lib tsconfig

Must have composite mode enabled:
```json
{
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "jsx": "react-jsx",
    "lib": ["esnext", "dom", "dom.iterable"]
  },
  "references": [{ "path": "../api-client-react" }]
}
```

## import.meta.env fix
The lib is compiled by tsc (not Vite), so `import.meta.env.BASE_URL` causes TS2339.
Use `new URL(document.baseURI).pathname` instead — standard DOM API, no Vite dependency.

**Why:** tsc does not have vite/client types unless explicitly added, and adding them to a shared lib creates unnecessary coupling.
