import { RIGHTS_POLICY_VERSION } from "./config";

export const TAGLINE = "Don't pay for a slot. Commit to your character.";

export const FLOW_STEPS = [
  { key: "CREATE", title: "Create", body: "Upload your character reference in Discord." },
  { key: "GENERATE", title: "Generate", body: "DevFridge AI turns it into a World-ready 3D asset." },
  { key: "CONFIRM", title: "Confirm", body: "Preview the model and confirm you have the rights to publish it." },
  { key: "REVIEW", title: "Review", body: "DevFridge checks the asset for technical and platform compatibility." },
  { key: "COMMIT", title: "Commit", body: "Commit the required $PASTA for the approved period." },
  { key: "ENTER", title: "Enter the World", body: "Your asset becomes eligible in DevFridge World." },
  { key: "ADOPTION", title: "Adoption", body: "Players decide how far it spreads." },
  {
    key: "EXIT",
    title: "Exit",
    body: "Remove the asset whenever you want. Your on-chain commitment still follows its original unlock rules.",
  },
] as const;

export const GENERATION_RIGHTS_STATEMENT = `I confirm that I created, own, licensed, or otherwise have the necessary rights and permissions to submit these images for AI processing and to create the resulting 3D asset.

I understand that third-party AI processing is used to generate a 3D asset from my images.
I understand that a $PASTA commitment does not grant intellectual-property rights.
Policy version: ${RIGHTS_POLICY_VERSION}`;

export const PUBLICATION_RIGHTS_STATEMENT = `I confirm that I have the rights necessary to publish and use this asset in DevFridge World. I grant DevFridge the limited rights necessary to host, process, display, distribute and technically adapt this asset while it is active in DevFridge World.

I understand that a $PASTA commitment does not grant intellectual-property rights.
I understand that DevFridge may suspend or remove the asset after a valid rights, legal, safety or platform-policy complaint.
I understand that removing the asset from DevFridge World does not necessarily unlock an existing on-chain commitment before its contractual unlock time.
Policy version: ${RIGHTS_POLICY_VERSION}`;

export const COMMITMENT_COPY =
  "Commit $PASTA to activate your character for a defined period. Your $PASTA remains committed under the DevFridge time-lock. When the commitment matures, redemption follows the protocol's claim rules, including the current 2% burn. A commitment does not grant rights to third-party IP.";

export const OPTOUT_COPY =
  "This removes the character from the game. It does not automatically unlock an existing DevFridge commitment before its on-chain unlock time.";

export const HELP_TEXT = [
  "**DevFridge World Creator** — apply your meme to the next World season.",
  "",
  "World is a browser game at world.devfridge.cool. The current pre-launch cast is the official kitchen. This Discord flow lets an external meme community submit a playable asset for later seasons.",
  "",
  "`/world create` — upload 1–4 images and start a submission",
  "`/world status` — check generation, review, commitment, eligibility",
  "`/world preview` — open the 3D preview",
  "`/world my-assets` — your submissions",
  "`/world optout` — remove an active asset from future game sessions",
  "`/world report` — report an asset",
  "",
  COMMITMENT_COPY,
  "",
  "Official contacts live only on connect.devfridge.cool. DevFridge never asks for a seed phrase.",
].join("\n");

export function submissionCreatedMessage(publicId: string): string {
  return [
    `🍝 Submission **${publicId}** created.`,
    "",
    "Your source images passed the initial checks.",
    "Accept the rights declaration to queue 3D generation.",
    "You will receive a preview before anything can be submitted for publication.",
    "",
    "A $PASTA commitment is not an IP license and is not a conventional listing fee. The principal stays under DevFridge time-lock rules; the current claim mechanism burns 2%.",
  ].join("\n");
}
