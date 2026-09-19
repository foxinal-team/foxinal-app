import { describe, expect, it } from "vitest";
import {
  detectLanguageByFileName,
  getLanguageExtension,
  SUPPORTED_LANGUAGES,
} from "./languages";

describe("editor languages", () => {
  it("detects language by filename and extension", () => {
    expect(detectLanguageByFileName("Dockerfile")).toBe("dockerfile");
    expect(detectLanguageByFileName("docker-compose.yml")).toBe("yaml");
    expect(detectLanguageByFileName("nginx.conf")).toBe("nginx");
    expect(detectLanguageByFileName(".env")).toBe("env");
    expect(detectLanguageByFileName(".env.production")).toBe("env");
    expect(detectLanguageByFileName("Cargo.toml")).toBe("toml");
    expect(detectLanguageByFileName("main.rs")).toBe("rust");
    expect(detectLanguageByFileName("script.py")).toBe("python");
    expect(detectLanguageByFileName("index.ts")).toBe("typescript");
    expect(detectLanguageByFileName("app.jsx")).toBe("javascript");
    expect(detectLanguageByFileName("styles.css")).toBe("css");
    expect(detectLanguageByFileName("query.sql")).toBe("sql");
    expect(detectLanguageByFileName("README.md")).toBe("markdown");
    expect(detectLanguageByFileName("changes.diff")).toBe("diff");
    expect(detectLanguageByFileName("unknown.xyz")).toBe("plaintext");
  });

  it("returns codemirror extensions for supported languages", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const ext = getLanguageExtension(lang.id);
      expect(Array.isArray(ext)).toBe(true);
    }
  });
});
