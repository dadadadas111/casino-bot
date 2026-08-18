/**
 * Which commands a given guild should see. Pure logic so it can be tested
 * without a Discord client or the bot environment.
 */

export interface NamedCommand {
  name: string;
}

/**
 * Owner tooling is registered to the home guild only. Everywhere else it used
 * to sit greyed out in every admin's command list, which was clutter and a
 * free hint that the bot has a back door.
 *
 * With no home guild configured we cannot tell which server is the owner's,
 * so nothing is hidden and behaviour matches the old build.
 */
export function commandsForGuild<T extends NamedCommand>(
  all: readonly T[],
  guildId: string,
  homeGuildId: string | undefined,
  ownerOnly: ReadonlySet<string>,
): T[] {
  if (!homeGuildId || guildId === homeGuildId) return [...all];
  return all.filter((command) => !ownerOnly.has(command.name));
}
