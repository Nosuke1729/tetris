#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");
const SHARED   = path.join(ROOT, "shared");

function stripTypes(src) {
  const lines = src.split("\n");
  const out = [];
  let skip = 0; // brace depth for skipping blocks

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip entire interface/type blocks
    if (/^(export\s+)?interface\s+\w/.test(trimmed) ||
        (/^(export\s+)?type\s+\w+\s*=\s*\{/.test(trimmed) && !trimmed.includes("=>"))) {
      skip = 0;
      for (const ch of line) { if (ch==="{") skip++; if (ch==="}") skip--; }
      while (skip > 0 && i+1 < lines.length) {
        i++;
        for (const ch of lines[i]) { if (ch==="{") skip++; if (ch==="}") skip--; }
      }
      continue;
    }

    // Skip simple type aliases
    if (/^(export\s+)?type\s+\w+\s*=\s*[^{]/.test(trimmed)) {
      while (!trimmed.endsWith(";") && i+1 < lines.length && !lines[i+1].trim().startsWith("export") && !lines[i+1].trim().startsWith("//")) {
        i++;
      }
      continue;
    }

    // Skip import type and export type lines
    if (/^\s*(import|export)\s+type[\s{]/.test(line)) continue;

    out.push(line);
  }

  let code = out.join("\n");

  // Remove import statements
  code = code.replace(/^import\s+(?:type\s+)?\{[^}]*\}\s+from\s+["'][^"']+["'];?\s*$/gm, "");
  code = code.replace(/^import\s+\*\s+as\s+\w+\s+from\s+["'][^"']+["'];?\s*$/gm, "");
  code = code.replace(/^import\s+\w+\s+from\s+["'][^"']+["'];?\s*$/gm, "");
  code = code.replace(/^export\s+\{[^}]*\};?\s*$/gm, "");
  code = code.replace(/^export\s+default\s+/gm, "");
  code = code.replace(/^export\s+(const|let|var|function|class)\b/gm, "$1");

  // Remove access modifiers
  code = code.replace(/\b(private|public|protected|readonly)\s+/g, "");

  // Remove return type annotations: ): ReturnType {  or ): void;
  code = code.replace(/\)\s*:\s*(?:void|boolean|number|string|[A-Z]\w*(?:<[^>]*>)?(?:\[\])?)\s*(?=\{|;|\n)/g, ") ");

  // Remove parameter type annotations (simple cases)
  code = code.replace(/(\w)\s*:\s*(?:void|boolean|number|string|[A-Z]\w*(?:<[^>]*>)?(?:\[\])?|\([^)]*\)\s*=>[\w\s<>\[\]]*)\s*(?=[,)=])/g, "$1");

  // Remove variable type annotations: let x: Type = / const x: Type =
  code = code.replace(/(\bconst|\blet|\bvar)\s+(\w+)\s*:\s*[^=,;)]+(?=\s*=)/g, "$1 $2");

  // Remove 'as Type' casts
  code = code.replace(/\s+as\s+(?:const\b|[A-Z]\w*(?:<[^>]*>)?(?:\[\])?)/g, "");

  // Remove '?' from optional params that still have it before =
  code = code.replace(/\?\s*:/g, ":");

  // Clean up any leftover ': number[] =' patterns
  code = code.replace(/\s*:\s*\w+(?:\[\])?\s*(?==\s)/g, " ");

  return code;
}

const ORDERED_FILES = [
  path.join(SHARED,   "constants.ts"),
  path.join(FRONTEND, "src/game/piece.ts"),
  path.join(FRONTEND, "src/game/board.ts"),
  path.join(FRONTEND, "src/game/bag.ts"),
  path.join(FRONTEND, "src/game/rotation.ts"),
  path.join(FRONTEND, "src/game/tspin.ts"),
  path.join(FRONTEND, "src/game/scoring.ts"),
  path.join(FRONTEND, "src/game/gameState.ts"),
  path.join(FRONTEND, "src/net/wsClient.ts"),
  path.join(FRONTEND, "src/ui/renderer.ts"),
  path.join(FRONTEND, "src/ui/input.ts"),
  path.join(FRONTEND, "src/ui/screens.ts"),
  path.join(FRONTEND, "src/main.ts"),
];

let bundle = `// Battle Tetris Web — auto-generated bundle\n"use strict";\n\n`;

for (const filePath of ORDERED_FILES) {
  const raw = fs.readFileSync(filePath, "utf8");
  const stripped = stripTypes(raw);
  bundle += `// ── ${path.relative(ROOT, filePath)} ──\n`;
  bundle += stripped.trim() + "\n\n";
}

// Syntax check
try {
  new Function(bundle.replace(/^"use strict";\n/, ""));
  console.log("✅ Syntax OK");
} catch (e) {
  console.error("❌ Syntax error:", e.message);
  const lines = bundle.split("\n");
  const match = e.message.match(/line (\d+)/i);
  if (match) {
    const ln = parseInt(match[1]);
    console.error("Context:");
    lines.slice(Math.max(0,ln-5), ln+5).forEach((l,i) => console.error(`${ln-5+i}: ${l}`));
  }
  process.exit(1);
}

const outPath = path.join(FRONTEND, "src/main.js");
fs.writeFileSync(outPath, bundle, "utf8");
console.log(`✅ Bundled → ${outPath} (${Math.round(bundle.length/1024)}KB)`);
