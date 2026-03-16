import { spawn } from "node:child_process";

const port = process.env.PORT || "3105";
const child = spawn("next", ["dev", "-p", port], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

let showedPortHelp = false;

function printPortHelp() {
  if (showedPortHelp) {
    return;
  }

  showedPortHelp = true;
  console.error("");
  console.error(`Port ${port} is already in use. Try:`);
  console.error(`  lsof -nP -iTCP:${port} -sTCP:LISTEN`);
  console.error("  kill -9 <PID>");
}

function forward(stream, output) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    output.write(text);

    if (text.includes("EADDRINUSE") || text.includes(`address already in use :::${port}`)) {
      printPortHelp();
    }
  });
}

forward(child.stdout, process.stdout);
forward(child.stderr, process.stderr);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
