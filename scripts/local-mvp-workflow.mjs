import { spawn } from "node:child_process";

const steps = [
  { name: "Build web", args: ["build"] },
  { name: "Unitarias", args: ["test"] },
  { name: "Flujo basico en navegador", args: ["test:e2e"] },
  { name: "Tres fotos reales", args: ["test:real"] },
  { name: "Tour grande 50 escenas", args: ["test:large"] },
  { name: "Diagnosticos de importacion", args: ["test:diagnostics"] }
];

for (const [index, step] of steps.entries()) {
  console.log(`\n[${index + 1}/${steps.length}] ${step.name}`);
  await runPnpm(step.args);
}

console.log("\nLocal MVP workflow passed: build, browser flow, real photos, large tour, diagnostics, and exported viewer.");

function runPnpm(args) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", `pnpm ${args.join(" ")}`] : args;

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`pnpm ${args.join(" ")} fallo con codigo ${code}.`));
    });
  });
}
