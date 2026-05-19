import anthropicLogo from "@/assets/logos/anthropic.svg";
import deepseekLogo from "@/assets/logos/deepseek.svg";
import googleLogo from "@/assets/logos/google.svg";
import metaLogo from "@/assets/logos/meta.svg";
import mistralLogo from "@/assets/logos/mistral.svg";
import openaiLogo from "@/assets/logos/openai.svg";
import xaiLogo from "@/assets/logos/xai.svg";

/** Provider logos (Simple Icons / Wikimedia, bundled locally). */
export const ORG_LOGOS: Record<string, string> = {
  openai: openaiLogo,
  anthropic: anthropicLogo,
  google: googleLogo,
  deepseek: deepseekLogo,
  meta: metaLogo,
  mistral: mistralLogo,
  xai: xaiLogo,
};

export function getOrgLogo(orgId: string): string | undefined {
  return ORG_LOGOS[orgId];
}
