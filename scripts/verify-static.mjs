import { readFile } from "node:fs/promises";
import { PROJECTS } from "../src/data/projects.js";

const files = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/style.css", import.meta.url), "utf8"),
  readFile(new URL("../src/main.js", import.meta.url), "utf8")
]);
const [html, css, main] = files;
const failures = [];

const requiredProjectFields = [
  "slug", "volume", "client", "title", "year", "industry", "services",
  "description", "technology", "url", "palette", "book"
];
PROJECTS.forEach((project, index) => {
  requiredProjectFields.forEach((field) => {
    if (project[field] == null) failures.push(`Project ${index + 1} is missing ${field}`);
  });
});

[
  "--parchment", "--paper", "--cream", "--ink", "--walnut", "--brass",
  "@media (prefers-reduced-motion: reduce)", "min-height: 100dvh"
].forEach((needle) => {
  if (!css.includes(needle)) failures.push(`CSS is missing ${needle}`);
});

[
  "data-project-buttons", "data-webgl-fallback", "data-close-project",
  "aria-live=\"polite\"", "Skip to content"
].forEach((needle) => {
  if (!html.includes(needle)) failures.push(`HTML is missing ${needle}`);
});

if (html.includes("\u2014") || html.includes("\u2013")) failures.push("Visible HTML contains a disallowed long dash");
if (main.includes("addEventListener(\"scroll\"")) failures.push("Main runtime uses a direct scroll listener");
if (PROJECTS.length !== 7) failures.push(`Expected 7 projects, found ${PROJECTS.length}`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Static verification passed: data, tokens, accessibility hooks, motion fallback, and copy checks are present.");
}
