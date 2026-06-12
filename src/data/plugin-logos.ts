import asanaLogo from "@/assets/logos/plugins/asana.svg";
import auth0Logo from "@/assets/logos/plugins/auth0.svg";
import awsLogo from "@/assets/logos/plugins/aws.svg";
import clerkLogo from "@/assets/logos/plugins/clerk.svg";
import cloudflareLogo from "@/assets/logos/plugins/cloudflare.svg";
import datadogLogo from "@/assets/logos/plugins/datadog.svg";
import discordLogo from "@/assets/logos/plugins/discord.svg";
import dockerLogo from "@/assets/logos/plugins/docker.svg";
import excalidrawLogo from "@/assets/logos/plugins/excalidraw.svg";
import figmaLogo from "@/assets/logos/plugins/figma.svg";
import firebaseAuthLogo from "@/assets/logos/plugins/firebase-authentication.svg";
import flyIoLogo from "@/assets/logos/plugins/fly-io.svg";
import googleAnalyticsLogo from "@/assets/logos/plugins/google-analytics.svg";
import googleCloudLogo from "@/assets/logos/plugins/google-cloud.svg";
import jiraLogo from "@/assets/logos/plugins/jira.svg";
import lemonSqueezyLogo from "@/assets/logos/plugins/lemon-squeezy.svg";
import linearLogo from "@/assets/logos/plugins/linear.svg";
import logrocketLogo from "@/assets/logos/plugins/logrocket.png";
import microsoftAzureLogo from "@/assets/logos/plugins/microsoft-azure.svg";
import microsoftTeamsLogo from "@/assets/logos/plugins/microsoft-teams.svg";
import miroLogo from "@/assets/logos/plugins/miro.svg";
import mixpanelLogo from "@/assets/logos/plugins/mixpanel.svg";
import mongodbAtlasLogo from "@/assets/logos/plugins/mongodb-atlas.svg";
import neonLogo from "@/assets/logos/plugins/neon.svg";
import netlifyLogo from "@/assets/logos/plugins/netlify.svg";
import paypalLogo from "@/assets/logos/plugins/paypal.svg";
import planetscaleLogo from "@/assets/logos/plugins/planetscale.svg";
import posthogLogo from "@/assets/logos/plugins/posthog.svg";
import railwayLogo from "@/assets/logos/plugins/railway.svg";
import renderLogo from "@/assets/logos/plugins/render.svg";
import sentryLogo from "@/assets/logos/plugins/sentry.svg";
import slackLogo from "@/assets/logos/plugins/slack.svg";
import stripeLogo from "@/assets/logos/plugins/stripe.svg";
import supabaseLogo from "@/assets/logos/plugins/supabase.svg";
import trelloLogo from "@/assets/logos/plugins/trello.svg";
import vercelLogo from "@/assets/logos/plugins/vercel.svg";

export interface PluginLogoMeta {
  src: string;
}

/** Brand logos bundled locally (colored Simple Icons, Homarr dashboard icons, official assets). */
const PLUGIN_LOGOS: Record<string, PluginLogoMeta> = {
  docker: { src: dockerLogo },
  figma: { src: figmaLogo },
  excalidraw: { src: excalidrawLogo },
  miro: { src: miroLogo },
  supabase: { src: supabaseLogo },
  neon: { src: neonLogo },
  planetscale: { src: planetscaleLogo },
  "mongodb-atlas": { src: mongodbAtlasLogo },
  vercel: { src: vercelLogo },
  netlify: { src: netlifyLogo },
  railway: { src: railwayLogo },
  render: { src: renderLogo },
  "fly-io": { src: flyIoLogo },
  aws: { src: awsLogo },
  "google-cloud": { src: googleCloudLogo },
  "microsoft-azure": { src: microsoftAzureLogo },
  cloudflare: { src: cloudflareLogo },
  linear: { src: linearLogo },
  jira: { src: jiraLogo },
  trello: { src: trelloLogo },
  asana: { src: asanaLogo },
  slack: { src: slackLogo },
  discord: { src: discordLogo },
  "microsoft-teams": { src: microsoftTeamsLogo },
  clerk: { src: clerkLogo },
  auth0: { src: auth0Logo },
  "firebase-authentication": { src: firebaseAuthLogo },
  stripe: { src: stripeLogo },
  paypal: { src: paypalLogo },
  "lemon-squeezy": { src: lemonSqueezyLogo },
  posthog: { src: posthogLogo },
  mixpanel: { src: mixpanelLogo },
  "google-analytics": { src: googleAnalyticsLogo },
  sentry: { src: sentryLogo },
  datadog: { src: datadogLogo },
  logrocket: { src: logrocketLogo },
};

export function getPluginLogo(pluginId: string): PluginLogoMeta | undefined {
  return PLUGIN_LOGOS[pluginId];
}
