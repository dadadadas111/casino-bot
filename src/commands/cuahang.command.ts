import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  SlashCommandBuilder,
} from 'discord.js';
import { buffs, economy, guildItems, quests } from '../context.js';
import { type GuildItem } from '../services/guild-items.service.js';
import { type EffectKind } from '../services/effects.service.js';
import { grantRole, removeRole } from '../services/roles.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import type { Command } from './types.js';

const RARITY_EMOJI: Record<string, string> = {
  common: '⚪',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡',
};

type Tab = 'shop' | 'bag';

interface State {
  tab: Tab;
  selected: number | null;
  note?: string;
}

/** Apply one of the three server-allowed active effects. */
function applyServerEffect(kind: EffectKind, userId: string): string {
  switch (kind) {
    case 'clear_work_cd': {
      const r = economy.drinkCoffee(userId);
      return r.overdosed
        ? '☕ Quá nhiều caffeine, bạn ngất và phải nhập viện!'
        : '☕ Đã xóa cooldown làm việc, cày tiếp được ngay.';
    }
    case 'escape_lockup':
      economy.release(userId);
      economy.discharge(userId);
      return '🗝️ Đã thoát khỏi tù và viện.';
    case 'luck_buff':
      buffs.activate(userId, 'mayman');
      return '🍀 Đã bật buff may mắn +10% tiền lời trong 1 giờ.';
    default:
      return 'Item này không dùng được.';
  }
}

// ---------- render ----------

function shopEmbed(guildId: string, userId: string): EmbedBuilder {
  const list = guildItems.list(guildId, { enabledOnly: true });
  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('🎁 Cửa hàng riêng của server')
    .setDescription(
      list.length
        ? list
            .map((it) => {
              const r = RARITY_EMOJI[it.rarity] ?? '⚪';
              const tag = it.roleId ? ` · role <@&${it.roleId}>` : '';
              return `${r} ${it.emoji} **${it.name}** · ${formatCoins(it.price)}${tag}\n-# ${it.description || ' '}`;
            })
            .join('\n')
        : 'Server này chưa có item riêng nào. Admin có thể tạo bằng `/quanly`.',
    )
    .setFooter({ text: `Ví của bạn: ${economy.getBalance(userId).toLocaleString('vi-VN')} xu` });
}

function bagEmbed(guildId: string, userId: string): EmbedBuilder {
  const owned = guildItems.inventory(guildId, userId);
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('🧳 Đồ server của bạn')
    .setDescription(
      owned.length
        ? owned
            .map(({ item, qty }) => {
              const r = RARITY_EMOJI[item.rarity] ?? '⚪';
              return `${r} ${item.emoji} **${item.name}** x${qty}\n-# ${item.description || ' '}`;
            })
            .join('\n')
        : 'Bạn chưa có item riêng nào của server này.',
    )
    .setFooter({ text: 'Xem cả bộ sưu tập và bảng xếp hạng bằng /suutap' });
}

function tabRow(tab: Tab): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(componentId('cua', 'tab', 'shop'))
      .setLabel('Cửa hàng')
      .setEmoji('🎁')
      .setStyle(tab === 'shop' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(tab === 'shop'),
    new ButtonBuilder()
      .setCustomId(componentId('cua', 'tab', 'bag'))
      .setLabel('Đồ của tôi')
      .setEmoji('🧳')
      .setStyle(tab === 'bag' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(tab === 'bag'),
  );
}

function selectRow(
  guildId: string,
  userId: string,
  state: State,
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const list =
    state.tab === 'shop'
      ? guildItems.list(guildId, { enabledOnly: true })
      : guildItems.inventory(guildId, userId).map((o) => o.item);
  if (!list.length) return null;
  const select = new StringSelectMenuBuilder()
    .setCustomId(componentId('cua', 'pick', state.tab))
    .setPlaceholder(state.tab === 'shop' ? 'Chọn item để mua...' : 'Chọn item để dùng...')
    .addOptions(
      list.slice(0, 25).map((it) => ({
        label: it.name.slice(0, 100),
        value: String(it.id),
        description: `${formatCoins(it.price)}`.slice(0, 100),
        emoji: it.emoji,
        default: state.selected === it.id,
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function actionRow(state: State, item: GuildItem | undefined): ActionRowBuilder<ButtonBuilder> | null {
  if (!item) return null;
  if (state.tab === 'shop') {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('cua', 'buy', String(item.id)))
        .setLabel(`Mua · ${formatCoins(item.price)}`)
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Success),
    );
  }
  if (item.usable && item.effect) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('cua', 'use', String(item.id)))
        .setLabel('Dùng')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Primary),
    );
  }
  return null;
}

function render(guildId: string, userId: string, state: State) {
  const embed = state.tab === 'shop' ? shopEmbed(guildId, userId) : bagEmbed(guildId, userId);
  if (state.note) embed.setDescription(`> ${state.note}\n\n${embed.data.description ?? ''}`);
  const item = state.selected ? guildItems.get(state.selected) ?? undefined : undefined;
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [tabRow(state.tab)];
  const sel = selectRow(guildId, userId, state);
  if (sel) rows.push(sel);
  const act = actionRow(state, item);
  if (act) rows.push(act);
  return { embeds: [embed], components: rows };
}

// ---------- command ----------

export const cuahangCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cuahang')
    .setDescription('Cửa hàng item riêng của server: mua đồ sưu tầm và đồ có hiệu ứng'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      ...render(interaction.guildId, interaction.user.id, { tab: 'shop', selected: null }),
      flags: MessageFlags.Ephemeral,
    });
  },
};

// ---------- interactions ----------

async function refresh(
  interaction: ButtonInteraction | AnySelectMenuInteraction,
  state: State,
): Promise<void> {
  await interaction.update(render(interaction.guildId!, interaction.user.id, state));
}

export const cuahangComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    if (!interaction.guildId) return;
    const [action, arg] = args;
    const userId = interaction.user.id;

    if (action === 'tab') {
      return refresh(interaction, { tab: arg === 'bag' ? 'bag' : 'shop', selected: null });
    }

    const id = Number(arg);
    const item = guildItems.get(id);
    if (!item || item.guildId !== interaction.guildId || !item.enabled) {
      return refresh(interaction, { tab: 'shop', selected: null, note: 'Item không còn nữa.' });
    }

    if (action === 'buy') {
      if (!economy.debit(userId, item.price, 'item', `sv:${id}`)) {
        return refresh(interaction, {
          tab: 'shop',
          selected: id,
          note: `Không đủ xu. Cần ${formatCoins(item.price)}.`,
        });
      }
      guildItems.addOwned(interaction.guildId, userId, id);
      quests.record(userId, ['buy']);
      if (item.roleId) await grantRole(interaction.guild as Guild, userId, item.roleId);
      return refresh(interaction, {
        tab: 'bag',
        selected: id,
        note: `Đã mua ${item.emoji} ${item.name}!`,
      });
    }

    if (action === 'use') {
      if (!item.usable || !item.effect) {
        return refresh(interaction, { tab: 'bag', selected: id, note: 'Item này không dùng được.' });
      }
      if (!guildItems.consumeOwned(interaction.guildId, userId, id)) {
        return refresh(interaction, { tab: 'bag', selected: id, note: 'Bạn không còn item này.' });
      }
      const msg = applyServerEffect(item.effect, userId);
      // Lost the last copy: drop the role that came with owning it.
      if (item.roleId && guildItems.ownedQty(interaction.guildId, userId, id) === 0) {
        await removeRole(interaction.guild as Guild, userId, item.roleId);
      }
      return refresh(interaction, { tab: 'bag', selected: id, note: msg });
    }
  },

  async handleSelect(interaction: AnySelectMenuInteraction, args: string[]): Promise<void> {
    if (!interaction.guildId) return;
    const [, tab] = args;
    const id = Number(interaction.values[0]);
    return refresh(interaction, { tab: tab === 'bag' ? 'bag' : 'shop', selected: id });
  },
};
