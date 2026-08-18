import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { cash, economy, luck, quizReview } from '../context.js';
import { env } from '../config/env.js';
import { JAIL_DURATION_MS } from '../services/economy.service.js';
import {
  ADMIN_ADD_CAP,
  ADMIN_SET_CAP,
  isCheatBusted,
} from '../services/enforcement.service.js';
import { XU_PER_VND } from '../services/cash.service.js';
import { runBackup } from '../backup-scheduler.js';
import { formatVnd } from '../embeds/topup.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { showNext } from './duyetcau.command.js';
import type { Command } from './types.js';

export function isOwner(userId: string): boolean {
  return Boolean(env.BOT_OWNER_ID) && userId === env.BOT_OWNER_ID;
}

interface MoneyAction {
  key: string;
  label: string;
  emoji: string;
  title: string;
  cap: number;
  unit: 'xu' | 'vnd' | 'percent';
}

const ACTIONS: MoneyAction[] = [
  { key: 'cong', label: 'Cộng xu', emoji: '➕', title: 'Cộng xu', cap: ADMIN_ADD_CAP, unit: 'xu' },
  { key: 'tru', label: 'Trừ xu', emoji: '➖', title: 'Trừ xu', cap: ADMIN_ADD_CAP, unit: 'xu' },
  { key: 'dat', label: 'Đặt số dư', emoji: '🎚️', title: 'Đặt số dư', cap: ADMIN_SET_CAP, unit: 'xu' },
  { key: 'napcho', label: 'Cộng tiền nạp', emoji: '💵', title: 'Cộng tiền nạp', cap: 10_000_000, unit: 'vnd' },
  { key: 'luck', label: 'Vận may', emoji: '🍀', title: 'Mức vận may', cap: 100, unit: 'percent' },
];

function panelEmbed(targetId: string | null, targetName: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('🛠️ Bảng điều khiển chủ bot')
    .setDescription(
      targetId
        ? [
            `Đang thao tác với **${targetName}**`,
            `👛 Ví: ${formatCoins(economy.getBalance(targetId))} · 🏦 Két: ${formatCoins(economy.getBank(targetId))}`,
            `💵 Tiền nạp: ${formatVnd(cash.get(targetId))} · 🍀 Vận may: ${Math.round(luck.get(targetId) * 100)}%`,
          ].join('\n')
        : 'Chọn một người chơi bên dưới để chỉnh xu, tiền nạp hoặc vận may.',
    )
    .setFooter({
      text: `Cộng/trừ tối đa ${ADMIN_ADD_CAP.toLocaleString('vi-VN')} xu mỗi lần · cảnh sát vẫn tuần tra`,
    });
  return embed;
}

export function ownerPanel(
  targetId: string | null,
  targetName: string | null,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | UserSelectMenuBuilder>[];
} {
  const suffix = targetId ?? '';
  return {
    embeds: [panelEmbed(targetId, targetName)],
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(componentId('own', 'target'))
          .setPlaceholder(targetId ? `Đang chọn: ${targetName}` : 'Chọn người chơi'),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ACTIONS.map((a) =>
          new ButtonBuilder()
            .setCustomId(componentId('own', a.key, suffix))
            .setLabel(a.label)
            .setEmoji(a.emoji)
            .setStyle(a.key === 'tru' ? ButtonStyle.Danger : ButtonStyle.Primary)
            .setDisabled(!targetId),
        ),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('own', 'duyet'))
          .setLabel('Duyệt câu hỏi')
          .setEmoji('🔍')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(componentId('own', 'backup'))
          .setLabel('Sao lưu ngay')
          .setEmoji('💾')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(componentId('own', 'luckList'))
          .setLabel('Ai đang được ưu ái')
          .setEmoji('📋')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export const chubotCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('chubot')
    .setDescription('Bảng điều khiển của chủ bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        content: 'Lệnh này chỉ chủ bot dùng được.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({ ...ownerPanel(null, null), flags: MessageFlags.Ephemeral });
  },
};

function amountModal(action: MoneyAction, targetId: string): ModalBuilder {
  const hint =
    action.unit === 'percent'
      ? 'Từ 0 đến 100 (0 = tắt ưu ái)'
      : action.unit === 'vnd'
        ? 'Số tiền VND'
        : `Số xu, tối đa ${action.cap.toLocaleString('vi-VN')}`;
  return new ModalBuilder()
    .setCustomId(componentId('own', 'apply', action.key, targetId))
    .setTitle(action.title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('giatri')
          .setLabel(action.unit === 'percent' ? 'Mức vận may' : 'Số lượng')
          .setPlaceholder(hint)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(12),
      ),
    );
}

export const ownerComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        content: 'Bảng này chỉ chủ bot dùng được.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const [action, targetId] = args;

    if (action === 'duyet') {
      if (!quizReview.available()) {
        await interaction.reply({
          content: 'Kho câu hỏi đang không kết nối được, thử lại sau.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await showNext((payload) => interaction.editReply(payload));
      return;
    }

    if (action === 'backup') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await runBackup(interaction.client, `thủ công bởi ${interaction.user.tag}`);
      await interaction.editReply({ content: `💾 ${result}` });
      return;
    }

    if (action === 'luckList') {
      const rows = luck.list();
      await interaction.reply({
        content:
          rows.length > 0
            ? [
                '🍀 Danh sách được ưu ái:',
                ...rows.map((r) => `<@${r.userId}> : ${Math.round(r.factor * 100)}%`),
              ].join('\n')
            : 'Chưa ưu ái ai cả, sòng bạc đang sạch.',
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    const spec = ACTIONS.find((a) => a.key === action);
    if (!spec || !targetId) return;
    await interaction.showModal(amountModal(spec, targetId));
  },

  async handleSelect(interaction: AnySelectMenuInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'target' || !interaction.isUserSelectMenu()) return;
    if (!isOwner(interaction.user.id)) return;
    const target = interaction.users.first();
    if (!target) return;
    await interaction.update(ownerPanel(target.id, target.displayName));
  },

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'apply' || !isOwner(interaction.user.id)) return;
    const spec = ACTIONS.find((a) => a.key === args[1]);
    const targetId = args[2];
    if (!spec || !targetId) return;

    const value = Number(interaction.fields.getTextInputValue('giatri').replace(/[.,\s]/g, ''));
    const complain = async (text: string): Promise<void> => {
      await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    };
    if (!Number.isInteger(value) || value < 0) {
      await complain('Nhập một số nguyên không âm nhé.');
      return;
    }
    if (value > spec.cap) {
      await complain(
        spec.unit === 'percent'
          ? 'Vận may chỉ từ 0 đến 100.'
          : `Tối đa ${spec.cap.toLocaleString('vi-VN')} mỗi lần.`,
      );
      return;
    }

    const target = await interaction.client.users.fetch(targetId).catch(() => null);
    const targetName = target?.displayName ?? 'người chơi';

    if (spec.key === 'luck') {
      luck.set(targetId, value / 100);
      await refresh(interaction, targetId, targetName);
      await interaction.followUp({
        content:
          value > 0
            ? `🍀 **${targetName}** giờ có ${value}% cơ hội được chơi lại mỗi khi thua ở tài xỉu, bầu cua, tung xu, xèng và đua ngựa.`
            : `✅ Đã gỡ vận may của **${targetName}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (spec.key === 'napcho') {
      if (value < 1_000) {
        await complain('Cộng tiền nạp từ 1.000đ trở lên.');
        return;
      }
      cash.credit(targetId, value, `manual:${interaction.user.id}`);
      await refresh(interaction, targetId, targetName);
      await interaction.followUp({
        content: `💵 Đã cộng ${formatVnd(value)} cho **${targetName}** (đổi được ${formatCoins(value * XU_PER_VND)}). Số dư nạp mới: ${formatVnd(cash.get(targetId))}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // The raid happens before any money moves, so a bust changes nothing.
    if (isCheatBusted()) {
      const release = economy.jail(interaction.user.id, JAIL_DURATION_MS);
      const attempt =
        spec.key === 'cong'
          ? `bơm ${formatCoins(value)} cho`
          : spec.key === 'tru'
            ? `rút trộm ${formatCoins(value)} của`
            : `sửa sổ sách thành ${formatCoins(value)} cho`;
      await refresh(interaction, targetId, targetName);
      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.lose)
            .setTitle('🚨 CẢNH SÁT ĐỘT KÍCH!')
            .setDescription(
              [
                `**${interaction.user.displayName}** đang lén ${attempt} **${targetName}** thì bị tóm tại trận!`,
                '',
                '❌ Giao dịch đã bị hủy, không một xu nào được chuyển.',
                `🚔 Bị áp giải về đồn, ra tù <t:${Math.floor(release.getTime() / 1000)}:R>.`,
                '',
                '-# Làm chủ bot không có nghĩa là đứng trên pháp luật.',
              ].join('\n'),
            ),
        ],
      });
      return;
    }

    let action: string;
    if (spec.key === 'cong') {
      economy.credit(targetId, value, 'admin_add');
      action = `Đã cộng **${formatCoins(value)}** cho`;
    } else if (spec.key === 'tru') {
      economy.debit(targetId, value, 'admin_sub');
      action = `Đã trừ **${formatCoins(value)}** của`;
    } else {
      economy.setBalance(targetId, value);
      action = `Đã đặt số dư **${formatCoins(value)}** cho`;
    }

    await refresh(interaction, targetId, targetName);
    await interaction.followUp({
      content: `🛠️ ${action} **${targetName}**. Số dư hiện tại: ${formatCoins(economy.getBalance(targetId))}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

async function refresh(
  interaction: ModalSubmitInteraction,
  targetId: string,
  targetName: string,
): Promise<void> {
  const panel = ownerPanel(targetId, targetName);
  if (interaction.isFromMessage()) await interaction.update(panel);
  else await interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
}
