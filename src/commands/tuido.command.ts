import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { assets, buffs, economy, items } from '../context.js';
import { SHOP_ITEMS } from '../services/items.service.js';
import {
  ASSETS,
  ASSET_LIST,
  KIND_LABEL,
  type AssetKind,
  canBuy,
} from '../services/assets.service.js';
import { BUFFS } from '../services/buff.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { announce } from '../interactions/announce.js';
import { refuseIfDown } from '../interactions/downtime.js';
import type { Command } from './types.js';

// Kept below twice the box price so opening boxes stays a losing habit.
const GIFT_BOX_MAX = 900;

type Tab = 'bag' | 'shop' | 'taisan';

interface PanelState {
  tab: Tab;
  selected: string;
}

const TABS: Tab[] = ['bag', 'shop', 'taisan'];

function asTab(raw: string | undefined): Tab {
  return TABS.includes(raw as Tab) ? (raw as Tab) : 'bag';
}

function parseState(args: string[], from = 1): PanelState {
  return { tab: asTab(args[from]), selected: args[from + 1] ?? '' };
}

function assetEmbed(userId: string): EmbedBuilder {
  const owned = assets.owned(userId);
  const byKind = (kind: AssetKind): string => {
    const mine = owned.find((a) => a.kind === kind);
    return ASSET_LIST.filter((a) => a.kind === kind)
      .map((a) => {
        const mark = mine?.key === a.key ? '✅' : mine && mine.tier > a.tier ? '▫️' : '▪️';
        return `${mark} ${a.emoji} **${a.name}** · ${formatCoins(a.price)}\n-# ${a.desc}`;
      })
      .join('\n');
  };
  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('🏠 Tài sản')
    .setDescription(
      owned.length > 0
        ? `Đang sở hữu: ${owned.map((a) => `${a.emoji} ${a.name}`).join(' · ')}`
        : 'Chưa có gì cả. Xu để trong két thì mãi chỉ là con số.',
    )
    .addFields(
      { name: `${KIND_LABEL.nha.emoji} ${KIND_LABEL.nha.name}`, value: byKind('nha') },
      { name: `${KIND_LABEL.xe.emoji} ${KIND_LABEL.xe.name}`, value: byKind('xe') },
      { name: `${KIND_LABEL.thucung.emoji} ${KIND_LABEL.thucung.name}`, value: byKind('thucung') },
    )
    .setFooter({
      text: `Ví: ${economy.getBalance(userId).toLocaleString('vi-VN')} xu · lên đời thì món cũ được thu lại nửa giá`,
    });
}

function panelEmbed(userId: string, state: PanelState): EmbedBuilder {
  if (state.tab === 'taisan') return assetEmbed(userId);
  if (state.tab === 'shop') {
    return new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle('🏪 Cửa hàng sòng bạc')
      .setDescription(
        Object.values(SHOP_ITEMS)
          .map((i) => `${i.emoji} **${i.name}** · ${formatCoins(i.price)}\n-# ${i.desc}`)
          .join('\n'),
      )
      .setFooter({ text: `Ví của bạn: ${economy.getBalance(userId).toLocaleString('vi-VN')} xu` });
  }

  const inv = items.inventory(userId);
  const active = buffs.activeList(userId);
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('🎒 Túi đồ')
    .setDescription(
      inv.length > 0
        ? inv
            .map((row) => {
              const item = SHOP_ITEMS[row.item];
              return `${item?.emoji ?? '❔'} **${item?.name ?? row.item}** x${row.qty}\n-# ${item?.desc ?? ''}`;
            })
            .join('\n')
        : 'Túi rỗng tuếch. Bấm **🏪 Cửa hàng** để sắm đồ đi!',
    )
    .setFooter({
      text:
        active.length > 0
          ? `Đang có hiệu lực: ${active.map((b) => BUFFS[b.buff]?.name ?? b.buff).join(', ')}`
          : 'Tặng đồ thì mỗi lần một món.',
    });
}

function tabRow(state: PanelState): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(componentId('bag', 'tab', 'bag'))
      .setLabel('Túi đồ')
      .setEmoji('🎒')
      .setStyle(state.tab === 'bag' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(state.tab === 'bag'),
    new ButtonBuilder()
      .setCustomId(componentId('bag', 'tab', 'shop'))
      .setLabel('Cửa hàng')
      .setEmoji('🏪')
      .setStyle(state.tab === 'shop' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(state.tab === 'shop'),
    new ButtonBuilder()
      .setCustomId(componentId('bag', 'tab', 'taisan'))
      .setLabel('Tài sản')
      .setEmoji('🏠')
      .setStyle(state.tab === 'taisan' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(state.tab === 'taisan'),
  );
}

function selectRow(
  userId: string,
  state: PanelState,
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const entries =
    state.tab === 'taisan'
      ? ASSET_LIST.map((a) => ({
          key: a.key,
          label: `${a.name} · ${a.price.toLocaleString('vi-VN')} xu`,
          emoji: a.emoji,
          desc: a.desc,
        }))
      : state.tab === 'shop'
      ? Object.values(SHOP_ITEMS).map((i) => ({
          key: i.key,
          label: `${i.name} · ${i.price.toLocaleString('vi-VN')} xu`,
          emoji: i.emoji,
          desc: i.desc,
        }))
      : items.inventory(userId).map((row) => {
          const item = SHOP_ITEMS[row.item];
          return {
            key: row.item,
            label: `${item?.name ?? row.item} x${row.qty}`,
            emoji: item?.emoji ?? '❔',
            desc: item?.desc ?? '',
          };
        });
  if (entries.length === 0) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(componentId('bag', 'pick', state.tab))
      .setPlaceholder(
        state.tab === 'taisan'
          ? 'Chọn tài sản muốn tậu'
          : state.tab === 'shop'
            ? 'Chọn món muốn mua'
            : 'Chọn món trong túi',
      )
      .addOptions(
        entries.slice(0, 25).map((e) =>
          new StringSelectMenuOptionBuilder()
            .setValue(e.key)
            .setLabel(e.label.slice(0, 100))
            .setDescription(e.desc.slice(0, 100))
            .setEmoji(e.emoji)
            .setDefault(e.key === state.selected),
        ),
      ),
  );
}

function actionRow(userId: string, state: PanelState): ActionRowBuilder<ButtonBuilder> | null {
  const key = state.selected;

  if (state.tab === 'taisan') {
    const asset = ASSETS[key];
    if (!asset) return null;
    const check = canBuy(assets.owned(userId), asset);
    const label = !check.ok
      ? check.reason === 'owned'
        ? 'Đang sở hữu rồi'
        : 'Không hạ đời được'
      : check.tradeIn
        ? `Lên đời ${asset.name} (${check.cost.toLocaleString('vi-VN')} xu)`
        : `Tậu ${asset.name} (${asset.price.toLocaleString('vi-VN')} xu)`;
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('bag', 'tau', state.tab, key))
        .setLabel(label)
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!check.ok || economy.getBalance(userId) < check.cost),
    );
  }

  const item = SHOP_ITEMS[key];
  if (!item) return null;

  if (state.tab === 'shop') {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('bag', 'buy', state.tab, key))
        .setLabel(`Mua ${item.name} (${item.price.toLocaleString('vi-VN')} xu)`)
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Success)
        .setDisabled(economy.getBalance(userId) < item.price),
    );
  }

  const owned = items.count(userId, key);
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (item.usable) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('bag', 'use', state.tab, key))
        .setLabel(`Dùng ${item.name}`)
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success)
        .setDisabled(owned < 1),
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(componentId('bag', 'gift', state.tab, key))
      .setLabel('Tặng cho ai đó')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(owned < 1),
  );
  return row;
}

export function bagPanel(
  userId: string,
  state: PanelState,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
} {
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [tabRow(state)];
  const select = selectRow(userId, state);
  if (select) rows.push(select);
  const actions = actionRow(userId, state);
  if (actions) rows.push(actions);
  return { embeds: [panelEmbed(userId, state)], components: rows };
}

export const tuidoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tuido')
    .setDescription('Túi đồ và cửa hàng: xem, mua, dùng, tặng, tất cả trong một bảng'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      ...bagPanel(interaction.user.id, { tab: 'bag', selected: '' }),
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** Familiar second door: /shop opens the same panel on the shop tab. */
export const shopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Cửa hàng vật phẩm của sòng bạc'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      ...bagPanel(interaction.user.id, { tab: 'shop', selected: '' }),
      flags: MessageFlags.Ephemeral,
    });
  },
};

async function buy(interaction: ButtonInteraction, key: string): Promise<void> {
  const item = SHOP_ITEMS[key];
  const userId = interaction.user.id;
  if (!item) return;

  if (!economy.debit(userId, item.price, 'item', key)) {
    await interaction.reply({
      content: `Không đủ xu! Cần ${formatCoins(item.price)}, ví của bạn: ${formatCoins(economy.getBalance(userId))}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Mystery boxes open on the spot, and that moment is worth sharing.
  if (key === 'hopqua') {
    const reward = Math.floor(Math.random() * (GIFT_BOX_MAX + 1));
    if (reward > 0) economy.credit(userId, reward, 'gift_box');
    await interaction.update(bagPanel(userId, { tab: 'shop', selected: key }));
    await announce(interaction, {
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
  await interaction.update(bagPanel(userId, { tab: 'shop', selected: key }));
  await interaction.followUp({
    content: `${item.emoji} Đã mua **${item.name}** với giá ${formatCoins(item.price)}. Đang có ${items.count(userId, key)} cái.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function use(interaction: ButtonInteraction, key: string): Promise<void> {
  const item = SHOP_ITEMS[key];
  const userId = interaction.user.id;
  if (!item) return;

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
      content: `Bạn không có ${item.emoji} **${item.name}** nào.`,
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

  await interaction.update(bagPanel(userId, { tab: 'bag', selected: key }));
  await announce(interaction, {
    embeds: [new EmbedBuilder().setColor(COLORS.win).setDescription(description)],
  });
}

async function acquire(interaction: ButtonInteraction, key: string): Promise<void> {
  const asset = ASSETS[key];
  const userId = interaction.user.id;
  if (!asset) return;

  const check = canBuy(assets.owned(userId), asset);
  if (!check.ok) {
    await interaction.reply({
      content:
        check.reason === 'owned'
          ? `Bạn đang sở hữu ${asset.emoji} **${asset.name}** rồi.`
          : 'Đang có món xịn hơn rồi, hạ đời làm gì!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!economy.debit(userId, check.cost, 'asset', key)) {
    await interaction.reply({
      content: `Không đủ xu! Cần ${formatCoins(check.cost)}, ví của bạn: ${formatCoins(economy.getBalance(userId))}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (check.tradeIn) assets.remove(userId, check.tradeIn.key);
  assets.add(userId, key);

  await interaction.update(bagPanel(userId, { tab: 'taisan', selected: key }));
  await announce(interaction, {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle(`${asset.emoji} Tậu ${asset.name}!`)
        .setDescription(
          [
            `**${interaction.user.displayName}** vừa xuống **${formatCoins(check.cost)}** để rước ${asset.emoji} **${asset.name}** về.`,
            check.tradeIn
              ? `-# ${check.tradeIn.emoji} ${check.tradeIn.name} cũ được thu lại nửa giá.`
              : '',
            `-# ${asset.desc}`,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
    ],
  });
}

export const bagComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const action = args[0];
    const userId = interaction.user.id;

    if (action === 'tab') {
      await interaction.update(bagPanel(userId, { tab: asTab(args[1]), selected: '' }));
      return;
    }
    const state = parseState(args);
    if (action === 'buy') {
      if (await refuseIfDown(interaction)) return;
      await buy(interaction, state.selected);
      return;
    }
    if (action === 'tau') {
      if (await refuseIfDown(interaction)) return;
      await acquire(interaction, state.selected);
      return;
    }
    if (action === 'use') {
      await use(interaction, state.selected);
      return;
    }
    if (action === 'gift') {
      const item = SHOP_ITEMS[state.selected];
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setTitle(`🎁 Tặng ${item?.emoji ?? ''} ${item?.name ?? state.selected}`)
            .setDescription('Chọn người nhận bên dưới. Mỗi lần tặng một món.'),
        ],
        components: [
          new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
            new UserSelectMenuBuilder()
              .setCustomId(componentId('bag', 'giftto', state.selected))
              .setPlaceholder('Tặng cho ai?'),
          ),
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(componentId('bag', 'tab', 'bag'))
              .setLabel('Quay lại túi đồ')
              .setEmoji('↩️')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }
  },

  async handleSelect(interaction: AnySelectMenuInteraction, args: string[]): Promise<void> {
    const userId = interaction.user.id;

    if (args[0] === 'pick' && interaction.isStringSelectMenu()) {
      await interaction.update(
        bagPanel(userId, { tab: asTab(args[1]), selected: interaction.values[0] }),
      );
      return;
    }

    if (args[0] === 'giftto' && interaction.isUserSelectMenu()) {
      const key = args[1];
      const item = SHOP_ITEMS[key];
      const target = interaction.users.first();
      if (!item || !target) return;

      if (target.bot || target.id === userId) {
        await interaction.update(bagPanel(userId, { tab: 'bag', selected: key }));
        await interaction.followUp({
          content: target.bot ? 'Bot không nhận quà đâu!' : 'Tặng chính mình thì được gì?',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!items.transfer(userId, target.id, key, 1)) {
        await interaction.update(bagPanel(userId, { tab: 'bag', selected: key }));
        await interaction.followUp({
          content: `Bạn không còn ${item.emoji} **${item.name}** để tặng.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.update(bagPanel(userId, { tab: 'bag', selected: key }));
      await announce(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.win)
            .setDescription(
              `🎁 **${interaction.user.displayName}** tặng ${item.emoji} **${item.name}** cho <@${target.id}>. Tình cảm quá!`,
            ),
        ],
        allowedMentions: { users: [target.id] },
      });
    }
  },
};
