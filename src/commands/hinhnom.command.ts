import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy, figurines, items } from '../context.js';
import { FIGURINE_EMOJIS, MAX_NAME_LENGTH, sanitizeName } from '../services/figurine.service.js';
import { SHOP_ITEMS } from '../services/items.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

const unix = (iso: string): number => Math.floor(Date.parse(iso.replace(' ', 'T') + 'Z') / 1000);

export const hinhnomCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('hinhnom')
    .setDescription('Hình nộm: người bạn tưởng tượng của riêng bạn')
    .addSubcommand((sc) =>
      sc
        .setName('tao')
        .setDescription('Dùng 🎎 Hình nộm trong túi để tạo, đặt tên luôn')
        .addStringOption((o) =>
          o
            .setName('ten')
            .setDescription(`Tên cho hình nộm (tối đa ${MAX_NAME_LENGTH} ký tự)`)
            .setRequired(true)
            .setMaxLength(MAX_NAME_LENGTH),
        )
        .addStringOption((o) =>
          o
            .setName('hinh')
            .setDescription('Chọn hình dáng')
            .setRequired(false)
            .addChoices(...FIGURINE_EMOJIS.map((e) => ({ name: e, value: e }))),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('xem')
        .setDescription('Ngắm hình nộm của mình hoặc của người khác')
        .addUserOption((o) => o.setName('nguoi').setDescription('Của ai').setRequired(false)),
    )
    .addSubcommand((sc) =>
      sc
        .setName('doiten')
        .setDescription('Đổi tên hoặc đổi hình, tốn 1 🏷️ Thẻ đổi tên')
        .addStringOption((o) =>
          o
            .setName('ten')
            .setDescription('Tên mới')
            .setRequired(false)
            .setMaxLength(MAX_NAME_LENGTH),
        )
        .addStringOption((o) =>
          o
            .setName('hinh')
            .setDescription('Hình mới')
            .setRequired(false)
            .addChoices(...FIGURINE_EMOJIS.map((e) => ({ name: e, value: e }))),
        ),
    )
    .addSubcommand((sc) => sc.setName('cuoi').setDescription('Cưới hình nộm của bạn'))
    .addSubcommand((sc) => sc.setName('bo').setDescription('Chia tay và vứt hình nộm đi')),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const ephemeral = { flags: MessageFlags.Ephemeral } as const;

    if (sub === 'xem') {
      const target = interaction.options.getUser('nguoi') ?? interaction.user;
      const fig = figurines.get(target.id);
      if (!fig) {
        await interaction.reply({
          content:
            target.id === userId
              ? 'Bạn chưa có hình nộm nào. Mua 🎎 trong `/shop` rồi `/hinhnom tao` nhé!'
              : `**${target.displayName}** chưa có hình nộm nào.`,
          ...ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.gold)
            .setTitle(`${fig.emoji} ${fig.name}`)
            .setDescription(
              [
                `Người bạn tưởng tượng của **${target.displayName}**`,
                `Ra đời <t:${unix(fig.createdAt)}:R>`,
                fig.married ? '💍 Đã nên duyên vợ chồng' : '🕊️ Vẫn chỉ là bạn',
              ].join('\n'),
            ),
        ],
      });
      return;
    }

    if (sub === 'tao') {
      if (figurines.get(userId)) {
        await interaction.reply({
          content: 'Bạn đã có một hình nộm rồi. Một là đủ, tham lam quá!',
          ...ephemeral,
        });
        return;
      }
      const name = sanitizeName(interaction.options.getString('ten', true));
      if (!name) {
        await interaction.reply({ content: 'Tên không hợp lệ, thử tên khác nhé.', ...ephemeral });
        return;
      }
      if (!items.consume(userId, 'hinhnom')) {
        await interaction.reply({
          content: `Bạn chưa có 🎎 Hình nộm nào. Mua trong \`/shop\` với giá ${formatCoins(SHOP_ITEMS.hinhnom.price)} đã nhé!`,
          ...ephemeral,
        });
        return;
      }
      const emoji = interaction.options.getString('hinh') ?? '🎎';
      figurines.create(userId, name, emoji);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.win)
            .setTitle(`${emoji} ${name} đã chào đời!`)
            .setDescription(
              `**${interaction.user.displayName}** vừa tạo ra người bạn tưởng tượng của mình.\nMuốn tiến xa hơn thì \`/hinhnom cuoi\`, đổi tên thì cần 🏷️ Thẻ đổi tên.`,
            ),
        ],
      });
      return;
    }

    const fig = figurines.get(userId);
    if (!fig) {
      await interaction.reply({
        content: 'Bạn chưa có hình nộm nào. Mua 🎎 trong `/shop` rồi `/hinhnom tao` nhé!',
        ...ephemeral,
      });
      return;
    }

    if (sub === 'doiten') {
      const rawName = interaction.options.getString('ten');
      const emoji = interaction.options.getString('hinh');
      if (!rawName && !emoji) {
        await interaction.reply({
          content: 'Muốn đổi gì thì phải nói: điền `ten`, `hinh`, hoặc cả hai.',
          ...ephemeral,
        });
        return;
      }
      const name = rawName ? sanitizeName(rawName) : null;
      if (rawName && !name) {
        await interaction.reply({ content: 'Tên không hợp lệ, thử tên khác nhé.', ...ephemeral });
        return;
      }
      if (!items.consume(userId, 'theten')) {
        await interaction.reply({
          content: `Cần 1 🏷️ Thẻ đổi tên (chỉ ${formatCoins(SHOP_ITEMS.theten.price)} trong \`/shop\`) mới đổi được.`,
          ...ephemeral,
        });
        return;
      }
      if (name) figurines.rename(userId, name);
      if (emoji) figurines.setEmoji(userId, emoji);
      const updated = figurines.get(userId)!;
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setDescription(
              `🏷️ Từ giờ người bạn tưởng tượng của **${interaction.user.displayName}** tên là **${updated.emoji} ${updated.name}**.`,
            ),
        ],
      });
      return;
    }

    if (sub === 'cuoi') {
      if (fig.married) {
        await interaction.reply({ content: 'Hai bạn cưới nhau rồi mà!', ...ephemeral });
        return;
      }
      const humanSpouse = economy.spouseOf(userId);
      if (humanSpouse) {
        await interaction.reply({
          content: `Bạn đang có gia đình với <@${humanSpouse}> rồi, đừng bắt cá hai tay!`,
          ...ephemeral,
        });
        return;
      }
      figurines.setMarried(userId, true);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.gold)
            .setTitle('💒 HÔN LỄ ĐẶC BIỆT 💒')
            .setDescription(
              [
                `**${interaction.user.displayName}** chính thức kết hôn với **${fig.emoji} ${fig.name}**!`,
                '',
                'Không cần ai đồng ý, không sợ bị từ chối, hạnh phúc tự tay xây lấy. 🥂',
                'Muốn đãi cả kênh thì mở tiệc bằng `/honle`.',
              ].join('\n'),
            ),
        ],
      });
      return;
    }

    // bo
    figurines.discard(userId);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.push)
          .setDescription(
            fig.married
              ? `💔 **${interaction.user.displayName}** và **${fig.emoji} ${fig.name}** đã đường ai nấy đi. Hình nộm được cất vào kho ký ức.`
              : `👋 **${interaction.user.displayName}** đã vứt **${fig.emoji} ${fig.name}** đi. Phũ phàng thật.`,
          ),
      ],
    });
  },
};
