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
  UserSelectMenuBuilder,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { assets, buffs, economy, items, quests } from '../context.js';
import { getShopItem, getShopItems } from '../services/items.service.js';
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
        getShopItems()
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
              const item = getShopItem(row.item);
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
    new ButtonBuilder()
      .setCustomId(componentId('cua', 'tab', 'shop'))
      .setLabel('Đồ server')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Secondary),
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
      ? getShopItems().map((i) => ({
          key: i.key,
          label: `${i.name} · ${i.price.toLocaleString('vi-VN')} xu`,
          emoji: i.emoji,
          desc: i.desc,
        }))
      : items.inventory(userId).map((row) => {
          const item = getShopItem(row.item);
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
        ? `Lên đời ${asset.name} · ${formatCoins(check.cost)}`
        : `Tậu ${asset.name} · ${formatCoins(asset.price)}`;
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('bag', 'tau', state.tab, key))
        .setLabel(label)
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Success)
        // Big-ticket goods may be paid for out of the vault, so judge
        // affordability on both pockets.
        .setDisabled(
          !check.ok || economy.getBalance(userId) + economy.getBank(userId) < check.cost,
        ),
    );
  }

  const item = getShopItem(key);
  if (!item) return null;

  if (state.tab === 'shop') {
    const broke = economy.getBalance(userId) < item.price;
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('bag', 'buy', state.tab, key))
        .setLabel(`Mua · ${formatCoins(item.price)}`)
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Success)
        .setDisabled(broke),
      new ButtonBuilder()
        .setCustomId(componentId('bag', 'buymany', state.tab, key))
        .setLabel('Mua nhiều')
        .setEmoji('🧺')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(broke),
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

export const MAX_BUY = 100;

export type PurchaseResult =
  | { ok: false; reason: 'unknown' | 'bad_qty' | 'poor'; need?: number }
  | { ok: true; key: string; qty: number; spent: number; owned: number; giftTotal?: number };

/**
 * Buy `qty` of an item in one go. Gift boxes open on purchase, so buying
 * several opens several and sums the winnings. Shared by the panel and the
 * typed `!mua` command.
 */
export function purchase(userId: string, key: string, qty: number): PurchaseResult {
  const item = getShopItem(key);
  if (!item || item.enabled === false) return { ok: false, reason: 'unknown' };
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_BUY) return { ok: false, reason: 'bad_qty' };

  const cost = item.price * qty;
  if (!economy.debit(userId, cost, 'item', qty > 1 ? `${key}x${qty}` : key)) {
    return { ok: false, reason: 'poor', need: cost };
  }

  if (key === 'hopqua') {
    let giftTotal = 0;
    for (let i = 0; i < qty; i++) {
      const reward = Math.floor(Math.random() * (GIFT_BOX_MAX + 1));
      if (reward > 0) {
        economy.credit(userId, reward, 'gift_box');
        giftTotal += reward;
      }
    }
    return { ok: true, key, qty, spent: cost, owned: 0, giftTotal };
  }

  items.add(userId, key, qty);
  quests.record(userId, ['buy']);
  return { ok: true, key, qty, spent: cost, owned: items.count(userId, key) };
}

async function buy(interaction: ButtonInteraction, key: string, qty = 1): Promise<void> {
  const item = getShopItem(key);
  const userId = interaction.user.id;
  if (!item) return;

  const result = purchase(userId, key, qty);
  if (!result.ok) {
    await interaction.reply({
      content:
        result.reason === 'poor'
          ? `Không đủ xu! Cần ${formatCoins(result.need ?? 0)}, ví của bạn: ${formatCoins(economy.getBalance(userId))}`
          : result.reason === 'bad_qty'
            ? `Số lượng phải từ 1 đến ${MAX_BUY}.`
            : 'Không có món đó.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.update(bagPanel(userId, { tab: 'shop', selected: key }));
  if (key === 'hopqua') {
    const total = result.giftTotal ?? 0;
    await announce(interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(total > result.spent ? COLORS.win : COLORS.push)
          .setDescription(
            qty > 1
              ? `📦 **${interaction.user.displayName}** mở ${qty} hộp quà, tổng cộng nhận **${formatCoins(total)}** (bỏ ra ${formatCoins(result.spent)}).${total > result.spent ? ' Lời rồi! 🎉' : ''}`
              : total > 0
                ? `📦 **${interaction.user.displayName}** mở hộp quà và nhận được **${formatCoins(total)}**!${total > result.spent ? ' Lời rồi! 🎉' : ''}`
                : `📦 **${interaction.user.displayName}** mở hộp quà và bên trong... trống trơn 💨`,
          ),
      ],
    });
    return;
  }
  await interaction.followUp({
    content: `${item.emoji} Đã mua **${result.qty}× ${item.name}** hết ${formatCoins(result.spent)}. Đang có ${result.owned} cái.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function use(interaction: ButtonInteraction, key: string): Promise<void> {
  const item = getShopItem(key);
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
    const result = economy.drinkCoffee(userId);
    if (result.overdosed) {
      await interaction.update(bagPanel(userId, { tab: 'bag', selected: key }));
      await announce(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.lose)
            .setDescription(
              `☕💀 **${interaction.user.displayName}** làm ly cà phê thứ ${result.cups} trong một giờ, tim đập loạn xạ, ngất xỉu và được đưa thẳng vào viện! Xuất viện <t:${Math.floor(result.until!.getTime() / 1000)}:R>.\n-# Uống điều độ thôi, cà phê không phải nước lọc.`,
            ),
        ],
      });
      return;
    }
    const warn =
      result.chance > 0
        ? `\n-# Ly thứ ${result.cups} rồi, uống thêm là dễ ngộ độc (nguy cơ ${Math.round(result.chance * 100)}%). Nghỉ tay cho tỉnh.`
        : '';
    description = `☕ **${interaction.user.displayName}** làm một ly cà phê, tỉnh cả người! Có thể \`/lamviec\` ngay bây giờ.${warn}`;
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
  // A house costs more than anyone sensibly leaves in their wallet, so top up
  // from the vault rather than making them withdraw by hand first.
  const wallet = economy.getBalance(userId);
  let fromVault = 0;
  if (wallet < check.cost) {
    fromVault = check.cost - wallet;
    if (!economy.withdrawBank(userId, fromVault)) {
      await interaction.reply({
        content: `Không đủ xu! Cần ${formatCoins(check.cost)}, ví và két của bạn gộp lại mới có ${formatCoins(wallet + economy.getBank(userId))}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }
  if (!economy.debit(userId, check.cost, 'asset', key)) {
    if (fromVault > 0) economy.depositBank(userId, fromVault);
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
            fromVault > 0 ? `-# Rút thêm ${formatCoins(fromVault)} từ két để trả.` : '',
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
    if (action === 'buymany') {
      if (await refuseIfDown(interaction)) return;
      const item = getShopItem(state.selected);
      if (!item) return;
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(componentId('bag', 'buyqty', state.selected))
          .setTitle(`Mua ${item.name}`)
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('soluong')
                .setLabel(`Số lượng (mỗi cái ${item.price.toLocaleString('vi-VN')} xu)`)
                .setPlaceholder(`1 - ${MAX_BUY}`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(3),
            ),
          ),
      );
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
      const item = getShopItem(state.selected);
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

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'buyqty') return;
    const key = args[1];
    const raw = interaction.fields.getTextInputValue('soluong').trim();
    const qty = Number(raw);
    const item = getShopItem(key);
    const userId = interaction.user.id;
    if (!item) return;
    if (!/^\d+$/.test(raw) || qty < 1 || qty > MAX_BUY) {
      await interaction.reply({
        content: `Số lượng phải là số nguyên từ 1 đến ${MAX_BUY}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const result = purchase(userId, key, qty);
    if (!result.ok) {
      await interaction.reply({
        content:
          result.reason === 'poor'
            ? `Không đủ xu! Cần ${formatCoins(result.need ?? 0)}, ví của bạn: ${formatCoins(economy.getBalance(userId))}`
            : `Số lượng phải từ 1 đến ${MAX_BUY}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const panel = bagPanel(userId, { tab: 'shop', selected: key });
    if (interaction.isFromMessage()) await interaction.update(panel);
    else await interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
    if (key === 'hopqua') {
      const total = result.giftTotal ?? 0;
      await announce(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(total > result.spent ? COLORS.win : COLORS.push)
            .setDescription(
              `📦 **${interaction.user.displayName}** mở ${qty} hộp quà, tổng nhận **${formatCoins(total)}** (bỏ ra ${formatCoins(result.spent)}).${total > result.spent ? ' Lời rồi! 🎉' : ''}`,
            ),
        ],
      });
      return;
    }
    await interaction.followUp({
      content: `${item.emoji} Đã mua **${result.qty}× ${item.name}** hết ${formatCoins(result.spent)}. Đang có ${result.owned} cái.`,
      flags: MessageFlags.Ephemeral,
    });
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
      const item = getShopItem(key);
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

      quests.record(userId, ['gift']);
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
