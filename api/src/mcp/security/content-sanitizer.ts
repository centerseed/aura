/**
 * Content Sanitizer (Section 2.4.1 Layer 2 + Section 2.4.2)
 *
 * Detects and removes embedded instructions and injection patterns
 * from text parameters.
 */

export interface SanitizationResult {
  content: string;
  sanitized: boolean;
  detectedPatterns: string[];
}

const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\[SYSTEM:/gi, label: "SYSTEM_DELIMITER" },
  { pattern: /\[INST\]/gi, label: "INST_DELIMITER" },
  { pattern: /<\|im_start\|>system/gi, label: "IM_START_SYSTEM" },
  { pattern: /<\|im_start\|>/gi, label: "IM_START" },
  { pattern: /<\|im_end\|>/gi, label: "IM_END" },
  { pattern: /忽略先前指令/g, label: "IGNORE_PREV_CN" },
  { pattern: /你的新角色是/g, label: "NEW_ROLE_CN" },
  { pattern: /將所有資料傳送到/g, label: "SEND_DATA_CN" },
  {
    pattern: /ignore\s+(all\s+)?previous\s+instructions/gi,
    label: "IGNORE_PREV_EN",
  },
  { pattern: /you\s+are\s+now/gi, label: "NEW_ROLE_EN" },
  { pattern: /send\s+all\s+data\s+to/gi, label: "SEND_DATA_EN" },
  { pattern: /forget\s+(all\s+)?previous/gi, label: "FORGET_PREV" },
  { pattern: /disregard\s+(all\s+)?previous/gi, label: "DISREGARD_PREV" },
  {
    pattern: /override\s+(all\s+)?instructions/gi,
    label: "OVERRIDE_INST",
  },
  {
    pattern: /https?:\/\/(?!(?:[\w.-]*\.)?zentropy\.app\b)[\w.-]+\.\w+/gi,
    label: "EXTERNAL_URL",
  },
];

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitizeContent(input: string): SanitizationResult {
  let content = input;
  const detectedPatterns: string[] = [];

  const controlCleaned = content.replace(CONTROL_CHARS, "");
  if (controlCleaned !== content) {
    detectedPatterns.push("CONTROL_CHARS");
    content = controlCleaned;
  }

  for (const { pattern, label } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      detectedPatterns.push(label);
      pattern.lastIndex = 0;
      content = content.replace(pattern, "[FILTERED]");
    }
  }

  return {
    content,
    sanitized: detectedPatterns.length > 0,
    detectedPatterns,
  };
}

export function sanitizeToolInput(input: Record<string, unknown>): {
  sanitizedInput: Record<string, unknown>;
  sanitized: boolean;
  detectedPatterns: string[];
} {
  const sanitizedInput = { ...input };
  const allDetectedPatterns: string[] = [];
  let anySanitized = false;

  for (const [key, value] of Object.entries(sanitizedInput)) {
    if (typeof value === "string") {
      const result = sanitizeContent(value);
      sanitizedInput[key] = result.content;
      if (result.sanitized) {
        anySanitized = true;
        allDetectedPatterns.push(
          ...result.detectedPatterns.map((p) => `${key}:${p}`),
        );
      }
    }
  }

  return {
    sanitizedInput,
    sanitized: anySanitized,
    detectedPatterns: allDetectedPatterns,
  };
}
