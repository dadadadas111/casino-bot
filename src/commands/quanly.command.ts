import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type ModalSubmitInteraction,
} from 'discord.js';
import { config, guildItems } from '../context.js';
import { MAX_GUILD_ITEMS, type GuildItem } from '../services/guild-items.service.js';
import { EFFECTS, SERVER_EFFECTS, effectLabel, isEffectKind } from '../services/effects.service.js';
import { roleBlockReason } from '../services/roles.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import type { Command } from './types.js';

const RARITIES: Record<string, { label: string; emoji: string }> = {
  common: { label: 'Thường', emoji: '⚪' },
  rare: { label: 'Hiếm', emoji: '🔵' },
  epic: { label: 'Cực hiếm', emoji: '🟣' },
  legendary: { label: 'Huyền thoại', emoji: '🟡' },
};

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
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(add));
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
      { name: 'Role tặng', value: item.roleId ? `<@&${item.roleId}>` : 'không', inline: true },
    );
  // Warn if a role is set but the bot cannot actually assign it.
  if (item.roleId) {
    const warn = roleBlockReason(guild, item.roleId);
    if (warn) embed.addFields({ name: '⚠️ Role chưa gán được', value: warn, inline: false });
  }
  return embed;
}

function manageRows(
  item: GuildItem,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder | RoleSelectMenuBuilder>[] {
  const effect = new StringSelectMenuBuilder()
    .setCustomId(componentId('qly', 'effect', String(item.id)))
    .setPlaceholder('Hiệu ứng...')
    .addOptions(
      { label: 'Không (chỉ sưu tầm)', value: 'none', emoji: '🎗️', default: !item.effect },
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
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(componentId('qly', 'toggle', String(item.id)))
      .setLabel(item.enabled ? 'Ẩn' : 'Bán')
      .setEmoji(item.enabled ? '🙈' : '🛒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(componentId('qly', 'edit', String(item.id)))
      .setLabel('Sửa tên/giá')
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
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(effect),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(role),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(rarity),
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
  const emoji = new TextInputBuilder()
    .setCustomId('emoji')
    .setLabel('Emoji (dán 1 emoji)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(16)
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
  if (item) {
    name.setValue(item.name);
    emoji.setValue(item.emoji);
    price.setValue(String(item.price));
    if (item.description) desc.setValue(item.description);
  }
  return modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(name),
    new ActionRowBuilder<TextInputBuilder>().addComponents(emoji),
    new ActionRowBuilder<TextInputBuilder>().addComponents(price),
    new ActionRowBuilder<TextInputBuilder>().addComponents(desc),
  );
}

// ---------- command ----------

export const quanlyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('quanly')
    .setDescription('Admin: quản lý item riêng của server (thêm, giá, hiệu ứng, role)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!hasAdmin(interaction)) {
      await interaction.reply({
        content: 'Chỉ admin (quyền Quản lý máy chủ) mới mở được bảng này.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      embeds: [homeEmbed(interaction.guildId)],
      components: homeRows(interaction.guildId),
      flags: MessageFlags.Ephemeral,
    });
  },
};

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
        guildItems.update(id, { effect: null, usable: false });
      } else if (isEffectKind(value) && EFFECTS[value].serverAllowed) {
        // Enforce the floor price so a server cannot undercut the economy.
        const floor = config.effectFloor(value);
        const patch: Record<string, unknown> = { effect: value, usable: true };
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
  },

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    if (!hasAdmin(interaction) || !interaction.guildId) return;
    const [action, rawId] = args;
    const name = interaction.fields.getTextInputValue('name').trim();
    const emoji = interaction.fields.getTextInputValue('emoji').trim();
    const priceRaw = interaction.fields.getTextInputValue('price').replace(/[^\d]/g, '');
    const desc = interaction.fields.getTextInputValue('desc').trim();
    const price = Number(priceRaw);

    if (!name || !emoji || !Number.isFinite(price) || price < 1) {
      await interaction.reply({
        content: 'Cần tên, emoji và giá hợp lệ (số nguyên ≥ 1). Thử lại nhé.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'create') {
      if (guildItems.count(interaction.guildId) >= MAX_GUILD_ITEMS) {
        await interaction.reply({ content: `Đã đủ ${MAX_GUILD_ITEMS} item.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const id = guildItems.create(interaction.guildId, { name, emoji, price, description: desc });
      return showManage(interaction, guildItems.get(id)!);
    }
    if (action === 'save') {
      const id = Number(rawId);
      const item = guildItems.get(id);
      if (!item || item.guildId !== interaction.guildId) return showHome(interaction, interaction.guildId);
      // Keep the floor if the item carries an effect.
      const floor = item.effect ? config.effectFloor(item.effect) : 0;
      guildItems.update(id, { name, emoji, price: Math.max(price, floor), description: desc });
      return showManage(interaction, guildItems.get(id)!);
    }
  },
};
