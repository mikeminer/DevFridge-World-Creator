const ATTACHMENT = 11;
const STRING = 3;
const SUB = 1;

const duration = {
  type: STRING,
  name: "duration",
  description: "Desired $PASTA commitment period (eligibility window)",
  required: true,
  choices: [
    { name: "7 days", value: "7d" },
    { name: "30 days", value: "30d" },
    { name: "90 days", value: "90d" },
  ],
};

export const WORLD_COMMAND = {
  name: "world",
  description: "DevFridge World Creator — submit a meme for the next World season",
  dm_permission: true,
  integration_types: [0],
  contexts: [0, 1],
  options: [
    {
      type: SUB,
      name: "create",
      description: "Start a creator submission from a reference image",
      options: [
        { type: STRING, name: "name", description: "Asset / character name", required: true, max_length: 80 },
        { type: STRING, name: "community", description: "Project or community name", required: true, max_length: 80 },
        {
          type: STRING,
          name: "description",
          description: "Short description of the character",
          required: true,
          max_length: 400,
        },
        duration,
        { type: ATTACHMENT, name: "image", description: "Primary reference image (PNG/JPEG/WEBP, max 8MB)", required: true },
        { type: ATTACHMENT, name: "image2", description: "Optional extra reference", required: false },
        { type: ATTACHMENT, name: "image3", description: "Optional extra reference", required: false },
        { type: ATTACHMENT, name: "image4", description: "Optional extra reference", required: false },
        { type: STRING, name: "mint", description: "Optional Solana token mint", required: false },
        { type: STRING, name: "website", description: "Optional project website", required: false },
        { type: STRING, name: "x", description: "Optional X/Twitter handle or URL", required: false },
        { type: STRING, name: "notes", description: "Notes for reviewers", required: false, max_length: 400 },
      ],
    },
    {
      type: SUB,
      name: "status",
      description: "Check a submission",
      options: [{ type: STRING, name: "id", description: "Submission id (DFW-1001)", required: false }],
    },
    {
      type: SUB,
      name: "preview",
      description: "Open the 3D preview",
      options: [{ type: STRING, name: "id", description: "Submission id (DFW-1001)", required: true }],
    },
    { type: SUB, name: "my-assets", description: "List your World Creator submissions" },
    {
      type: SUB,
      name: "optout",
      description: "Remove an asset from future World sessions",
      options: [{ type: STRING, name: "id", description: "Asset id (DFW-1001)", required: true }],
    },
    {
      type: SUB,
      name: "report",
      description: "Report a World Creator asset",
      options: [
        { type: STRING, name: "id", description: "Asset id (DFW-1001)", required: true },
        {
          type: STRING,
          name: "category",
          description: "Report category",
          required: true,
          choices: [
            { name: "Copyright", value: "COPYRIGHT" },
            { name: "Trademark", value: "TRADEMARK" },
            { name: "Personality / likeness", value: "PERSONALITY_LIKENESS" },
            { name: "Stolen asset", value: "STOLEN_ASSET" },
            { name: "Impersonation", value: "IMPERSONATION" },
            { name: "Illegal content", value: "ILLEGAL_CONTENT" },
            { name: "Safety", value: "SAFETY" },
            { name: "Scam", value: "SCAM" },
            { name: "Other", value: "OTHER" },
          ],
        },
        { type: STRING, name: "description", description: "What is wrong", required: true, max_length: 500 },
        { type: STRING, name: "evidence", description: "Optional evidence URL", required: false },
      ],
    },
    { type: SUB, name: "help", description: "How World Creator works" },
  ],
};

export const WORLD_ADMIN_COMMAND = {
  name: "world-admin",
  description: "DevFridge World Creator moderation",
  default_member_permissions: "8",
  dm_permission: false,
  integration_types: [0],
  contexts: [0],
  options: [
    { type: SUB, name: "queue", description: "List submissions under review" },
    {
      type: SUB,
      name: "review",
      description: "Show a review card",
      options: [{ type: STRING, name: "id", description: "Submission id", required: true }],
    },
    {
      type: SUB,
      name: "approve",
      description: "Approve for commitment quote",
      options: [{ type: STRING, name: "id", description: "Submission id", required: true }],
    },
    {
      type: SUB,
      name: "reject",
      description: "Reject a submission",
      options: [
        { type: STRING, name: "id", description: "Submission id", required: true },
        { type: STRING, name: "reason", description: "Reason", required: true },
      ],
    },
    {
      type: SUB,
      name: "quote",
      description: "Issue the $PASTA commitment quote",
      options: [{ type: STRING, name: "id", description: "Submission id", required: true }],
    },
    {
      type: SUB,
      name: "suspend",
      description: "Suspend an active asset",
      options: [
        { type: STRING, name: "id", description: "Asset id", required: true },
        { type: STRING, name: "reason", description: "Reason", required: true },
      ],
    },
    {
      type: SUB,
      name: "restore",
      description: "Restore a suspended asset",
      options: [{ type: STRING, name: "id", description: "Asset id", required: true }],
    },
  ],
};

export const COMMANDS = [WORLD_COMMAND, WORLD_ADMIN_COMMAND];
