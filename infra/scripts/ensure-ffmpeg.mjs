import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}

function runQuiet(command, args) {
  return spawnSync(command, args, { stdio: "ignore" });
}

function hasBinary(binary) {
  return runQuiet("which", [binary]).status === 0;
}

function hasFfmpeg() {
  return runQuiet("ffmpeg", ["-version"]).status === 0;
}

function canUsePasswordlessSudo() {
  if (!hasBinary("sudo")) {
    return false;
  }

  return runQuiet("sudo", ["-n", "true"]).status === 0;
}

function runWithOptionalSudo(command, args) {
  const direct = run(command, args);
  if (direct.status === 0) {
    return true;
  }

  if (!canUsePasswordlessSudo()) {
    return false;
  }

  const withSudo = run("sudo", ["-n", command, ...args]);
  return withSudo.status === 0;
}

function getInstallPlan() {
  const plans = [
    {
      name: "homebrew",
      available: () => hasBinary("brew"),
      steps: [["brew", ["install", "ffmpeg"]]],
    },
    {
      name: "apt-get",
      available: () => hasBinary("apt-get"),
      steps: [
        ["apt-get", ["update"]],
        ["apt-get", ["install", "-y", "ffmpeg"]],
      ],
    },
    {
      name: "apk",
      available: () => hasBinary("apk"),
      steps: [["apk", ["add", "--no-cache", "ffmpeg"]]],
    },
    {
      name: "dnf",
      available: () => hasBinary("dnf"),
      steps: [["dnf", ["install", "-y", "ffmpeg"]]],
    },
    {
      name: "yum",
      available: () => hasBinary("yum"),
      steps: [["yum", ["install", "-y", "ffmpeg"]]],
    },
  ];

  return plans.find((plan) => plan.available()) ?? null;
}

function main() {
  if (hasFfmpeg()) {
    console.log("[ensure-ffmpeg] ffmpeg is already installed.");
    return;
  }

  const plan = getInstallPlan();
  if (!plan) {
    throw new Error(
      "ffmpeg is missing and no supported package manager was found (tried: brew, apt-get, apk, dnf, yum).",
    );
  }

  console.log(`[ensure-ffmpeg] ffmpeg not found. Installing via ${plan.name}...`);

  for (const [command, args] of plan.steps) {
    const ok = runWithOptionalSudo(command, args);
    if (!ok) {
      throw new Error(
        `Failed to run '${command} ${args.join(" ")}'. Ensure this process has package-install permissions.`,
      );
    }
  }

  if (!hasFfmpeg()) {
    throw new Error("ffmpeg installation finished but ffmpeg is still unavailable on PATH.");
  }

  console.log("[ensure-ffmpeg] ffmpeg installed and available.");
}

main();
