import "./load-env";
import { registerGuildCommands } from "../lib/discord/register";

async function main() {
  const result = await registerGuildCommands();
  console.log(`Registered ${result.names.length} guild commands on ${result.guildId}:`);
  for (const name of result.names) console.log(`  /${name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
