import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { economy, figurines, items } from '../context.js';
import { FIGURINE_EMOJIS, MAX_NAME_LENGTH, sanitizeName } from '../services/figurine.service.js';
import { SHOP_ITEMS } from '../services/items.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { announce } from '../interactions/announce.js';
import type { Command } from './types.js';

const unix = (iso: string): number => Math.floor(Date.parse(iso.replace(' ', 'T') + 'Z') / 1000);

/**
 * Staged edits so changing both the name and the shape still costs a single
 * 🏷️ card. Lives in memory: losing it on restart only means picking again.
 */
interface Draft {
  name?: string;
  emoji?: string;
  expiresAt: number;
}
const drafts = new Map<string, Draft>();
const DRAFT_TTL_MS = 5 * 60 * 1000;

function draftOf(userId: string): Draft {
  const existing = drafts.get(userId);
  if (existing && existing.expiresAt > Date.now()) return existing;
  const fresh: Draft = { expiresAt: Date.now() + DRAFT_TTL_MS };
  drafts.set(userId, fresh);
  return fresh;
}

type Mode = 'view' | 'create' | 'edit';

function figurineEmbed(userId: string, displayName: string, mode: Mode): EmbedBuilder {
  const fig = figurines.get(userId);
  const draft = mode === 'view' ? null : draftOf(userId);

  if (mode === 'create') {
    return new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('🎎 Tạo hình nộm')
      .setDescription(
        [
          `Hình dáng: **${draft?.emoji ?? '🎎'}**`,
          `Tên: **${draft?.name ?? 'chưa đặt'}**`,
          '',
          'Chọn hình bên dưới, bấm **Đặt tên**, rồi **Tạo**.',
          `Tốn 1 ${SHOP_ITEMS.hinhnom.emoji} Hình nộm trong túi (đang có ${items.count(userId, 'hinhnom')}).`,
        ].join('\n'),
      );
  }

  if (mode === 'edit' && fig) {
    return new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('🏷️ Sửa hình nộm')
      .setDescription(
        [
          `Hiện tại: **${fig.emoji} ${fig.name}**`,
          `Sẽ thành: **${draft?.emoji ?? fig.emoji} ${draft?.name ?? fig.name}**`,
          '',
          `Tốn 1 ${SHOP_ITEMS.theten.emoji} Thẻ đổi tên (đang có ${items.count(userId, 'theten')}), đổi cả tên lẫn hình cũng chỉ mất một thẻ.`,
        ].join('\n'),
      );
  }

  if (!fig) {
    return new EmbedBuilder()
      .setColor(COLORS.push)
      .setTitle('🎎 Chưa có hình nộm')
      .setDescription(
        [
          `**${displayName}** chưa có người bạn tưởng tượng nào.`,
          '',
          `Mua ${SHOP_ITEMS.hinhnom.emoji} Hình nộm trong \`/tuido\` (${formatCoins(SHOP_ITEMS.hinhnom.price)}) rồi quay lại đây.`,
          `Đang có trong túi: **${items.count(userId, 'hinhnom')}**`,
        ].join('\n'),
      );
  }

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`${fig.emoji} ${fig.name}`)
    .setDescription(
      [
        `Người bạn tưởng tượng của **${displayName}**`,
        `Ra đời <t:${unix(fig.createdAt)}:R>`,
        fig.married ? '💍 Đã nên duyên vợ chồng' : '🕊️ Vẫn chỉ là bạn',
      ].join('\n'),
    );
}

function emojiSelect(userId: string, mode: Mode): ActionRowBuilder<StringSelectMenuBuilder> {
  const draft = draftOf(userId);
  const current = draft.emoji ?? figurines.get(userId)?.emoji ?? '🎎';
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(componentId('fig', 'shape', mode))
      .setPlaceholder('Chọn hình dáng')
      .addOptions(
        FIGURINE_EMOJIS.map((e) =>
          new StringSelectMenuOptionBuilder()
            .setValue(e)
            .setLabel(e)
            .setEmoji(e)
            .setDefault(e === current),
        ),
      ),
  );
}

export function figurinePanel(
  userId: string,
  displayName: string,
  mode: Mode = 'view',
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
} {
  const fig = figurines.get(userId);
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  if (mode === 'create' || mode === 'edit') {
    const draft = draftOf(userId);
    rows.push(emojiSelect(userId, mode));
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('fig', 'name', mode))
          .setLabel(mode === 'create' ? 'Đặt tên' : 'Đổi tên')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(componentId('fig', mode === 'create' ? 'make' : 'save'))
          .setLabel(mode === 'create' ? 'Tạo' : 'Xác nhận đổi')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
          .setDisabled(mode === 'create' ? !draft.name : !draft.name && !draft.emoji),
        new ButtonBuilder()
          .setCustomId(componentId('fig', 'cancel'))
          .setLabel('Hủy')
          .setEmoji('↩️')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
    return { embeds: [figurineEmbed(userId, displayName, mode)], components: rows };
  }

  if (!fig) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('fig', 'new'))
          .setLabel('Tạo hình nộm')
          .setEmoji('🎎')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(items.count(userId, 'hinhnom') < 1),
      ),
    );
    return { embeds: [figurineEmbed(userId, displayName, 'view')], components: rows };
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('fig', 'editmode'))
        .setLabel('Đổi tên & hình')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(items.count(userId, 'theten') < 1),
      fig.married
        ? new ButtonBuilder()
            .setCustomId(componentId('fig', 'divorce'))
            .setLabel('Ly hôn')
            .setEmoji('💔')
            .setStyle(ButtonStyle.Secondary)
        : new ButtonBuilder()
            .setCustomId(componentId('fig', 'marry'))
            .setLabel('Cưới')
            .setEmoji('💍')
            .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(componentId('fig', 'discard'))
        .setLabel('Vứt đi')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger),
    ),
  );
  return { embeds: [figurineEmbed(userId, displayName, 'view')], components: rows };
}

export const hinhnomCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('hinhnom')
    .setDescription('Hình nộm: người bạn tưởng tượng của riêng bạn')
    .addUserOption((o) =>
      o.setName('nguoi').setDescription('Ngắm hình nộm của người khác').setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi');
    if (target && target.id !== interaction.user.id) {
      const fig = figurines.get(target.id);
      if (!fig) {
        await interaction.reply({
          content: `**${target.displayName}** chưa có hình nộm nào.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [figurineEmbed(target.id, target.displayName, 'view')],
      });
      return;
    }
    drafts.delete(interaction.user.id);
    await interaction.reply({
      ...figurinePanel(interaction.user.id, interaction.user.displayName),
      flags: MessageFlags.Ephemeral,
    });
  },
};

function nameModal(mode: Mode): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(componentId('fig', 'name', mode))
    .setTitle(mode === 'create' ? 'Đặt tên hình nộm' : 'Đổi tên hình nộm')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ten')
          .setLabel('Tên')
          .setPlaceholder(`Tối đa ${MAX_NAME_LENGTH} ký tự`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(MAX_NAME_LENGTH),
      ),
    );
}

export const figurineComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const action = args[0];
    const userId = interaction.user.id;
    const displayName = interaction.user.displayName;

    if (action === 'new') {
      drafts.delete(userId);
      await interaction.update(figurinePanel(userId, displayName, 'create'));
      return;
    }
    if (action === 'editmode') {
      drafts.delete(userId);
      await interaction.update(figurinePanel(userId, displayName, 'edit'));
      return;
    }
    if (action === 'cancel') {
      drafts.delete(userId);
      await interaction.update(figurinePanel(userId, displayName));
      return;
    }
    if (action === 'name') {
      await interaction.showModal(nameModal(args[1] === 'create' ? 'create' : 'edit'));
      return;
    }

    if (action === 'make') {
      const draft = draftOf(userId);
      if (figurines.get(userId)) {
        await interaction.update(figurinePanel(userId, displayName));
        return;
      }
      if (!draft.name) return;
      if (!items.consume(userId, 'hinhnom')) {
        await interaction.update(figurinePanel(userId, displayName));
        await interaction.followUp({
          content: `Bạn chưa có ${SHOP_ITEMS.hinhnom.emoji} Hình nộm nào trong túi.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const emoji = draft.emoji ?? '🎎';
      figurines.create(userId, draft.name, emoji);
      drafts.delete(userId);
      await interaction.update(figurinePanel(userId, displayName));
      await announce(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.win)
            .setTitle(`${emoji} ${draft.name} đã chào đời!`)
            .setDescription(
              `**${displayName}** vừa tạo ra người bạn tưởng tượng của mình. Muốn tiến xa hơn thì bấm 💍 Cưới trong \`/hinhnom\`.`,
            ),
        ],
      });
      return;
    }

    if (action === 'save') {
      const draft = draftOf(userId);
      const fig = figurines.get(userId);
      if (!fig || (!draft.name && !draft.emoji)) return;
      if (!items.consume(userId, 'theten')) {
        await interaction.update(figurinePanel(userId, displayName));
        await interaction.followUp({
          content: `Cần 1 ${SHOP_ITEMS.theten.emoji} Thẻ đổi tên (chỉ ${formatCoins(SHOP_ITEMS.theten.price)} trong \`/tuido\`).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (draft.name) figurines.rename(userId, draft.name);
      if (draft.emoji) figurines.setEmoji(userId, draft.emoji);
      drafts.delete(userId);
      const updated = figurines.get(userId)!;
      await interaction.update(figurinePanel(userId, displayName));
      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setDescription(
              `🏷️ Từ giờ người bạn tưởng tượng của **${displayName}** tên là **${updated.emoji} ${updated.name}**.`,
            ),
        ],
      });
      return;
    }

    const fig = figurines.get(userId);
    if (!fig) return;

    if (action === 'marry') {
      const humanSpouse = economy.spouseOf(userId);
      if (humanSpouse) {
        await interaction.reply({
          content: `Bạn đang có gia đình với <@${humanSpouse}> rồi, đừng bắt cá hai tay!`,
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
        });
        return;
      }
      figurines.setMarried(userId, true);
      await interaction.update(figurinePanel(userId, displayName));
      await announce(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.gold)
            .setTitle('💒 HÔN LỄ ĐẶC BIỆT 💒')
            .setDescription(
              [
                `**${displayName}** chính thức kết hôn với **${fig.emoji} ${fig.name}**!`,
                '',
                'Không cần ai đồng ý, không sợ bị từ chối, hạnh phúc tự tay xây lấy. 🥂',
                'Muốn đãi cả kênh thì mở tiệc bằng `/cuoi`.',
              ].join('\n'),
            ),
        ],
      });
      return;
    }

    if (action === 'divorce') {
      figurines.setMarried(userId, false);
      await interaction.update(figurinePanel(userId, displayName));
      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.push)
            .setDescription(
              `💔 **${displayName}** đã ly hôn với **${fig.emoji} ${fig.name}**. Hình nộm vẫn nằm trong tủ, chỉ là hết duyên thôi.`,
            ),
        ],
      });
      return;
    }

    if (action === 'discard') {
      figurines.discard(userId);
      await interaction.update(figurinePanel(userId, displayName));
      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.push)
            .setDescription(
              fig.married
                ? `💔 **${displayName}** và **${fig.emoji} ${fig.name}** đã đường ai nấy đi. Hình nộm được cất vào kho ký ức.`
                : `👋 **${displayName}** đã vứt **${fig.emoji} ${fig.name}** đi. Phũ phàng thật.`,
            ),
        ],
      });
    }
  },

  async handleSelect(interaction: AnySelectMenuInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'shape' || !interaction.isStringSelectMenu()) return;
    const mode: Mode = args[1] === 'create' ? 'create' : 'edit';
    draftOf(interaction.user.id).emoji = interaction.values[0];
    await interaction.update(figurinePanel(interaction.user.id, interaction.user.displayName, mode));
  },

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'name') return;
    const mode: Mode = args[1] === 'create' ? 'create' : 'edit';
    const name = sanitizeName(interaction.fields.getTextInputValue('ten'));
    if (!name) {
      await interaction.reply({
        content: 'Tên không hợp lệ, thử tên khác nhé.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    draftOf(interaction.user.id).name = name;
    const panel = figurinePanel(interaction.user.id, interaction.user.displayName, mode);
    if (interaction.isFromMessage()) await interaction.update(panel);
    else await interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
  },
};
