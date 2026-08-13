import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { buffs, economy, items } from '../context.js';
import { SHOP_ITEMS, USABLE_ITEMS } from '../services/items.service.js';
import { BUFFS } from '../services/buff.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

// Kept below twice the box price so opening boxes stays a losing habit.
const GIFT_BOX_MAX = 900;

export const shopCommand: Command = {
  data: new SlashCommandBuilder().setName('shop').setDescription('Cửa hàng vật phẩm của sòng bạc'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('🛒 Cửa hàng sòng bạc')
          .setDescription(
            Object.values(SHOP_ITEMS)
              .map((i) => `${i.emoji} **${i.name}** · ${formatCoins(i.price)}\n-# ${i.desc}`)
              .join('\n'),
          )
          .setFooter({ text: 'Mua bằng /mua · Xem đồ bằng /tuido · Dùng đồ bằng /dungdo' }),
      ],
    });
  },
};

export const muaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('mua')
    .setDescription('Mua vật phẩm trong shop')
    .addStringOption((o) =>
      o
        .setName('mon')
        .setDescription('Vật phẩm muốn mua')
        .setRequired(true)
        .addChoices(
          ...Object.values(SHOP_ITEMS).map((i) => ({
            name: `${i.emoji} ${i.name} (${i.price.toLocaleString('vi-VN')} xu)`,
            value: i.key,
          })),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const key = interaction.options.getString('mon', true);
    const item = SHOP_ITEMS[key];
    const userId = interaction.user.id;

    if (!economy.debit(userId, item.price, 'item', key)) {
      await interaction.reply({
        content: `Không đủ xu! Cần ${formatCoins(item.price)}, ví của bạn: ${formatCoins(economy.getBalance(userId))}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Mystery boxes open on the spot.
    if (key === 'hopqua') {
      const reward = Math.floor(Math.random() * (GIFT_BOX_MAX + 1));
      if (reward > 0) economy.credit(userId, reward, 'gift_box');
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(reward > item.price ? COLORS.win : COLORS.push)
            .setDescription(
              reward > 0
                ? `📦 **${interaction.user.displayName}** mở hộp quà và nhận được **${formatCoins(reward)}**!${reward > item.price ? ' Lời rồi! 🎉' : ''}`
                : `📦 **${interaction.user.displayName}** mở hộp quà và bên trong... trống trơn 💨`,
            ),
        ],
      });
      return;
    }

    items.add(userId, key);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.win)
          .setDescription(
            `${item.emoji} Đã mua **${item.name}** với giá ${formatCoins(item.price)}. Đang có: ${items.count(userId, key)} cái. Xem \`/tuido\``,
          ),
      ],
    });
  },
};

export const dungdoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('dungdo')
    .setDescription('Dùng vật phẩm trong túi (bùa may mắn, cà phê, chìa khóa)')
    .addStringOption((o) =>
      o
        .setName('mon')
        .setDescription('Vật phẩm muốn dùng')
        .setRequired(true)
        .addChoices(
          ...USABLE_ITEMS.map((i) => ({ name: `${i.emoji} ${i.name}`, value: i.key })),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const key = interaction.options.getString('mon', true);
    const item = SHOP_ITEMS[key];
    const userId = interaction.user.id;

    // Check the effect is worth using BEFORE burning the item.
    const jailed = economy.jailedUntil(userId);
    const hospitalized = economy.hospitalizedUntil(userId);
    if (key === 'chiakhoa' && !jailed && !hospitalized) {
      await interaction.reply({
        content: 'Bạn đang tự do mà, cần phá khóa gì!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!items.consume(userId, key)) {
      await interaction.reply({
        content: `Bạn không có ${item.emoji} **${item.name}** nào. Ghé \`/shop\` mua nhé!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let description: string;
    if (key === 'buamayman') {
      const until = buffs.activate(userId, 'mayman');
      description = `🍀 **${interaction.user.displayName}** kích hoạt **${BUFFS.mayman.name}**! Mọi ván thắng +10% tiền lời đến <t:${Math.floor(until.getTime() / 1000)}:R>.`;
    } else if (key === 'caphe') {
      economy.resetCooldown(userId, 'work');
      description = `☕ **${interaction.user.displayName}** làm một ly cà phê, tỉnh cả người! Có thể \`/lamviec\` ngay bây giờ.`;
    } else {
      economy.release(userId);
      economy.discharge(userId);
      description = jailed
        ? `🗝️ **${interaction.user.displayName}** phá khóa vượt ngục thành công, không tốn một xu nộp phạt!`
        : `🗝️ **${interaction.user.displayName}** lẻn khỏi bệnh viện, quên luôn hóa đơn viện phí!`;
    }

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.win).setDescription(description)],
    });
  },
};

export const tuidoCommand: Command = {
  data: new SlashCommandBuilder().setName('tuido').setDescription('Xem túi đồ của bạn'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const inv = items.inventory(interaction.user.id);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle(`🎒 Túi đồ của ${interaction.user.displayName}`)
          .setDescription(
            inv.length > 0
              ? inv
                  .map((row) => {
                    const item = SHOP_ITEMS[row.item];
                    return `${item?.emoji ?? '❔'} **${item?.name ?? row.item}** x${row.qty}`;
                  })
                  .join('\n')
              : 'Túi rỗng tuếch. Ghé `/shop` sắm đồ đi!',
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
