import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type Guild,
  type ModalSubmitInteraction,
} from 'discord.js';
import { config, guildItems } from '../context.js';
import { MAX_GUILD_ITEMS, type GuildItem } from '../services/guild-items.service.js';
import { EFFECTS, SERVER_EFFECTS, effectLabel, isEffectKind } from '../services/effects.service.js';
import { roleBlockReason } from '../services/roles.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
const RARITIES: Record<string, { label: string; emoji: string }> = {
  common: { label: 'Thường', emoji: '⚪' },
  rare: { label: 'Hiếm', emoji: '🔵' },
  epic: { label: 'Cực hiếm', emoji: '🟣' },
  legendary: { label: 'Huyền thoại', emoji: '🟡' },
};

// Discord modals cannot show an emoji picker, so the icon is chosen by clicking
// from this palette in the manage view instead of pasting one into a text box.
const EMOJI_PALETTE = [
  '🎁', '🏆', '🥇', '👑', '💎', '⭐', '🌟', '🔥', '💰', '🪙', '🎖️', '🏅',
  '🃏', '🎰', '🎲', '🍀', '💍', '🐉', '🦄', '🌈', '⚡', '❤️', '🎀', '🗿',
];

const DEFAULT_ITEM_EMOJI = '🎁';

/** Accept a unicode emoji or a custom-emoji tag like <:name:12345>. */
function isValidEmoji(s: string): boolean {
  if (/^<a?:\w{2,32}:\d{5,}>$/.test(s)) return true;
  return /\p{Extended_Pictographic}/u.test(s) && [...s].length <= 12;
}

function rarityMeta(key: string): { label: string; emoji: string } {
  return RARITIES[key] ?? RARITIES.common;
}

function hasAdmin(interaction: { memberPermissions?: { has(flag: bigint): boolean } | null }): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

// ---------- home view: the server's item list ----------

function homeEmbed(guildId: string): EmbedBuilder {
  const items = guildItems.list(guildId);
  const lines = items.length
    ? items.map((it) => {
        const r = rarityMeta(it.rarity);
        const tags = [
          effectLabel(it.effect),
          it.roleId ? `role <@&${it.roleId}>` : null,
          it.enabled ? null : 'đang ẩn',
        ]
          .filter(Boolean)
          .join(' · ');
        return `${r.emoji} ${it.emoji} **${it.name}** — ${formatCoins(it.price)}\n-# ${tags}`;
      })
    : ['Chưa có item riêng nào. Bấm **Thêm item** để tạo cái đầu tiên.'];
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('🎁 Item riêng của server này')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${items.length}/${MAX_GUILD_ITEMS} item · chỉ bán trong server này` });
}

function homeRows(guildId: string): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const items = guildItems.list(guildId);
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  if (items.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(componentId('qly', 'pick'))
      .setPlaceholder('Chọn item để sửa...')
      .addOptions(
        items.slice(0, 25).map((it) => ({
          label: it.name.slice(0, 100),
          value: String(it.id),
          description: `${formatCoins(it.price)} · ${effectLabel(it.effect)}`.slice(0, 100),
          emoji: it.emoji,
        })),
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }
  const add = new ButtonBuilder()
    .setCustomId(componentId('qly', 'add'))
    .setLabel('Thêm item')
    .setEmoji('➕')
    .setStyle(ButtonStyle.Success)
    .setDisabled(items.length >= MAX_GUILD_ITEMS);
  const back = new ButtonBuilder()
    .setCustomId(componentId('cfg', 'view', 'home'))
    .setLabel('Cài đặt')
    .setEmoji('↩️')
    .setStyle(ButtonStyle.Secondary);
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(add, back));
  return rows;
}

// ---------- manage view: a single item ----------

function manageEmbed(item: GuildItem, guild: Guild): EmbedBuilder {
  const r = rarityMeta(item.rarity);
  const embed = new EmbedBuilder()
    .setColor(item.enabled ? COLORS.info : COLORS.push)
    .setTitle(`${item.emoji} ${item.name}`)
    .setDescription(item.description || '-# (chưa có mô tả)')
    .addFields(
      { name: 'Giá', value: formatCoins(item.price), inline: true },
      { name: 'Độ hiếm', value: `${r.emoji} ${r.label}`, inline: true },
      { name: 'Trạng thái', value: item.enabled ? 'Đang bán ✅' : 'Đang ẩn ❌', inline: true },
      { name: 'Hiệu ứng', value: effectLabel(item.effect), inline: true },
    );
  if (item.effect === 'grant_role') {
    embed.addFields({
      name: 'Role tặng',
      value: item.roleId ? `<@&${item.roleId}>` : 'chưa chọn — chọn role bên dưới hoặc bấm Tạo role mới',
      inline: true,
    });
    // Warn if a role is set but the bot cannot actually assign it.
    if (item.roleId) {
      const warn = roleBlockReason(guild, item.roleId);
      if (warn) embed.addFields({ name: '⚠️ Role chưa gán được', value: warn, inline: false });
    }
  }
  return embed;
}

function manageRows(
  item: GuildItem,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder | RoleSelectMenuBuilder>[] {
  const emoji = new StringSelectMenuBuilder()
    .setCustomId(componentId('qly', 'emoji', String(item.id)))
    .setPlaceholder('Biểu tượng...')
    .addOptions(EMOJI_PALETTE.map((e) => ({ label: e, value: e, default: item.emoji === e })));
  const effect = new StringSelectMenuBuilder()
    .setCustomId(componentId('qly', 'effect', String(item.id)))
    .setPlaceholder('Hiệu ứng...')
    .addOptions(
      { label: 'Không', value: 'none', emoji: '🚫', default: !item.effect },
      { label: 'Nhận role Discord', value: 'grant_role', emoji: '🎭', default: item.effect === 'grant_role' },
      ...SERVER_EFFECTS.map((e) => ({
        label: e.label.slice(0, 100),
        value: e.kind,
        description: `giá sàn ${formatCoins(config.effectFloor(e.kind))}`.slice(0, 100),
        default: item.effect === e.kind,
      })),
    );
  const role = new RoleSelectMenuBuilder()
    .setCustomId(componentId('qly', 'role', String(item.id)))
    .setPlaceholder('Role tặng khi sở hữu (bỏ trống để gỡ)...')
    .setMinValues(0)
    .setMaxValues(1);
  const rarity = new StringSelectMenuBuilder()
    .setCustomId(componentId('qly', 'rarity', String(item.id)))
    .setPlaceholder('Độ hiếm...')
    .addOptions(
      Object.entries(RARITIES).map(([key, r]) => ({
        label: r.label,
        value: key,
        emoji: r.emoji,
        default: item.rarity === key,
      })),
    );
  const grantsRole = item.effect === 'grant_role';
  const createRole = new ButtonBuilder()
    .setCustomId(componentId('qly', 'taorole', String(item.id)))
    .setLabel('Tạo role mới')
    .setEmoji('✨')
    .setStyle(ButtonStyle.Secondary);
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(componentId('qly', 'toggle', String(item.id)))
      .setLabel(item.enabled ? 'Ẩn' : 'Bán')
      .setEmoji(item.enabled ? '🙈' : '🛒')
      .setStyle(ButtonStyle.Secondary),
    ...(grantsRole ? [createRole] : []),
    new ButtonBuilder()
      .setCustomId(componentId('qly', 'edit', String(item.id)))
      .setLabel('Sửa')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(componentId('qly', 'del', String(item.id)))
      .setLabel('Xóa')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(componentId('qly', 'home'))
      .setLabel('Danh sách')
      .setEmoji('↩️')
      .setStyle(ButtonStyle.Secondary),
  );
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(emoji),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(effect),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(rarity),
    ...(grantsRole
      ? [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(role)]
      : []),
    buttons,
  ];
}

// ---------- add / edit modal ----------

function itemModal(id: number | null, item?: GuildItem): ModalBuilder {
  const action = id === null ? 'create' : `save:${id}`;
  const modal = new ModalBuilder()
    .setCustomId(componentId('qly', action))
    .setTitle(id === null ? 'Thêm item mới' : 'Sửa item');
  const name = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('Tên item')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(60)
    .setRequired(true);
  const price = new TextInputBuilder()
    .setCustomId('price')
    .setLabel('Giá (xu)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(9)
    .setRequired(true);
  const desc = new TextInputBuilder()
    .setCustomId('desc')
    .setLabel('Mô tả')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(200)
    .setRequired(false);
  // Custom emoji is optional: leave it blank to pick from the palette instead,
  // or paste any emoji here (unicode, or a :custom: from this server).
  const emoji = new TextInputBuilder()
    .setCustomId('emoji')
    .setLabel('Emoji riêng (bỏ trống để chọn từ bảng)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(40)
    .setRequired(false);
  if (item) {
    name.setValue(item.name);
    price.setValue(String(item.price));
    if (item.description) desc.setValue(item.description);
    emoji.setValue(item.emoji);
  }
  return modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(name),
    new ActionRowBuilder<TextInputBuilder>().addComponents(emoji),
    new ActionRowBuilder<TextInputBuilder>().addComponents(price),
    new ActionRowBuilder<TextInputBuilder>().addComponents(desc),
  );
}

// Reached from the /caidat panel (a button), not a standalone slash command.
// ---------- interaction routing ----------

async function showHome(interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction, guildId: string): Promise<void> {
  const payload = { embeds: [homeEmbed(guildId)], components: homeRows(guildId) };
  if (interaction.isModalSubmit() && !interaction.isFromMessage()) {
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.update(payload);
  }
}

async function showManage(
  interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction,
  item: GuildItem,
): Promise<void> {
  const guild = interaction.guild!;
  const payload = { embeds: [manageEmbed(item, guild)], components: manageRows(item) };
  if (interaction.isModalSubmit() && !interaction.isFromMessage()) {
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.update(payload);
  }
}

export const quanlyComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    if (!hasAdmin(interaction) || !interaction.guildId) return;
    const [action, rawId] = args;
    const id = rawId ? Number(rawId) : null;

    if (action === 'home') return showHome(interaction, interaction.guildId);
    if (action === 'add') {
      if (guildItems.count(interaction.guildId) >= MAX_GUILD_ITEMS) {
        await interaction.reply({ content: `Đã đủ ${MAX_GUILD_ITEMS} item, xóa bớt trước đã.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.showModal(itemModal(null));
      return;
    }
    if (id === null) return;
    const item = guildItems.get(id);
    if (!item || item.guildId !== interaction.guildId) return showHome(interaction, interaction.guildId);

    if (action === 'edit') {
      await interaction.showModal(itemModal(id, item));
      return;
    }
    if (action === 'toggle') {
      guildItems.update(id, { enabled: !item.enabled });
      return showManage(interaction, guildItems.get(id)!);
    }
    if (action === 'del') {
      const confirm = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('qly', 'delyes', String(id)))
          .setLabel('Xóa hẳn')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(componentId('qly', 'manage', String(id)))
          .setLabel('Thôi')
          .setStyle(ButtonStyle.Secondary),
      );
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.lose)
            .setTitle(`Xóa "${item.name}"?`)
            .setDescription('Item bị gỡ khỏi shop và mọi người sẽ mất nó khỏi bộ sưu tập. Không hoàn lại được.'),
        ],
        components: [confirm],
      });
      return;
    }
    if (action === 'delyes') {
      guildItems.remove(id);
      return showHome(interaction, interaction.guildId);
    }
    if (action === 'manage') {
      return showManage(interaction, item);
    }
    if (action === 'taorole') {
      const guild = interaction.guild;
      if (!guild || item.effect !== 'grant_role') return showManage(interaction, item);
      if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
          content: '⚠️ Bot thiếu quyền **Manage Roles** nên chưa tạo được role. Cấp quyền rồi thử lại.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferUpdate();
      try {
        const role = await guild.roles.create({
          name: item.name.slice(0, 90) || 'Vật phẩm sưu tầm',
          color: 0xf1c40f,
          mentionable: false,
          reason: `Role cho vật phẩm sưu tầm "${item.name}"`,
        });
        guildItems.update(id, { roleId: role.id });
      } catch (error) {
        console.error('[quanly] create role failed:', error);
      }
      const fresh = guildItems.get(id)!;
      await interaction.editReply({ embeds: [manageEmbed(fresh, guild)], components: manageRows(fresh) });
      return;
    }
  },

  async handleSelect(interaction: AnySelectMenuInteraction, args: string[]): Promise<void> {
    if (!hasAdmin(interaction) || !interaction.guildId) return;
    const [action, rawId] = args;

    if (action === 'pick') {
      const id = Number(interaction.values[0]);
      const item = guildItems.get(id);
      if (!item || item.guildId !== interaction.guildId) return showHome(interaction, interaction.guildId);
      return showManage(interaction, item);
    }

    const id = Number(rawId);
    const item = guildItems.get(id);
    if (!item || item.guildId !== interaction.guildId) return showHome(interaction, interaction.guildId);

    if (action === 'effect') {
      const value = interaction.values[0];
      if (value === 'none') {
        guildItems.update(id, { effect: null, usable: false, roleId: null });
      } else if (value === 'grant_role') {
        // Role-granting item: not consumed, keeps its chosen role.
        guildItems.update(id, { effect: 'grant_role', usable: false });
      } else if (isEffectKind(value) && EFFECTS[value].serverAllowed && EFFECTS[value].floor > 0) {
        // A consumable effect: enforce the floor and drop any role it had.
        const floor = config.effectFloor(value);
        const patch: Record<string, unknown> = { effect: value, usable: true, roleId: null };
        if (item.price < floor) patch.price = floor;
        guildItems.update(id, patch);
      }
      return showManage(interaction, guildItems.get(id)!);
    }
    if (action === 'role') {
      const roleId = interaction.isRoleSelectMenu() ? (interaction.values[0] ?? null) : null;
      guildItems.update(id, { roleId });
      return showManage(interaction, guildItems.get(id)!);
    }
    if (action === 'rarity') {
      const rarity = interaction.values[0];
      if (rarity in RARITIES) guildItems.update(id, { rarity });
      return showManage(interaction, guildItems.get(id)!);
    }
    if (action === 'emoji') {
      const emoji = interaction.values[0];
      if (EMOJI_PALETTE.includes(emoji)) guildItems.update(id, { emoji });
      return showManage(interaction, guildItems.get(id)!);
    }
  },

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    if (!hasAdmin(interaction) || !interaction.guildId) return;
    const [action, rawId] = args;
    const name = interaction.fields.getTextInputValue('name').trim();
    const priceRaw = interaction.fields.getTextInputValue('price').replace(/[^\d]/g, '');
    const desc = interaction.fields.getTextInputValue('desc').trim();
    const emojiRaw = interaction.fields.getTextInputValue('emoji').trim();
    const customEmoji = emojiRaw && isValidEmoji(emojiRaw) ? emojiRaw : null;
    const price = Number(priceRaw);

    if (!name || !Number.isFinite(price) || price < 1) {
      await interaction.reply({
        content: 'Cần tên và giá hợp lệ (số nguyên ≥ 1). Thử lại nhé.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'create') {
      if (guildItems.count(interaction.guildId) >= MAX_GUILD_ITEMS) {
        await interaction.reply({ content: `Đã đủ ${MAX_GUILD_ITEMS} item.`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Use the pasted emoji if given, else a default the admin can change
      // from the palette in the manage view that opens next.
      const id = guildItems.create(interaction.guildId, {
        name,
        emoji: customEmoji ?? DEFAULT_ITEM_EMOJI,
        price,
        description: desc,
      });
      return showManage(interaction, guildItems.get(id)!);
    }
    if (action === 'save') {
      const id = Number(rawId);
      const item = guildItems.get(id);
      if (!item || item.guildId !== interaction.guildId) return showHome(interaction, interaction.guildId);
      // Keep the floor if the item carries an effect.
      const floor = item.effect ? config.effectFloor(item.effect) : 0;
      const patch: Record<string, unknown> = { name, price: Math.max(price, floor), description: desc };
      if (customEmoji) patch.emoji = customEmoji;
      guildItems.update(id, patch);
      return showManage(interaction, guildItems.get(id)!);
    }
  },
};
