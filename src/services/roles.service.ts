import { PermissionFlagsBits, type Guild } from 'discord.js';

/**
 * Reason the bot cannot hand out this role, or null when it can. Used both to
 * warn an admin in /quanly and to skip role sync quietly when buying.
 */
export function roleBlockReason(guild: Guild, roleId: string): string | null {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return 'Bot thiếu quyền **Manage Roles**. Cấp quyền rồi role mới tự gán được.';
  }
  const role = guild.roles.cache.get(roleId);
  if (!role) return 'Role không còn tồn tại. Chọn lại role khác.';
  if (role.managed || role.id === guild.id) return 'Role này do hệ thống quản lý, không gán được.';
  if (role.position >= me.roles.highest.position) {
    return 'Role này nằm **trên** role của bot. Kéo role bot lên cao hơn trong Server Settings.';
  }
  return null;
}

/** Give a member the item's role. Best-effort: does nothing if it cannot. */
export async function grantRole(guild: Guild, userId: string, roleId: string): Promise<void> {
  if (roleBlockReason(guild, roleId)) return;
  try {
    const member = await guild.members.fetch(userId);
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, 'Sở hữu item sưu tầm');
    }
  } catch (error) {
    console.error('[roles] grant failed:', error);
  }
}

/** Take the item's role back once a member no longer owns any. Best-effort. */
export async function removeRole(guild: Guild, userId: string, roleId: string): Promise<void> {
  try {
    const member = await guild.members.fetch(userId);
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, 'Không còn item sưu tầm');
    }
  } catch (error) {
    console.error('[roles] remove failed:', error);
  }
}
