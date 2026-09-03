import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { prefixes, reports } from '../context.js';
import { env } from '../config/env.js';
import { DEFAULT_PREFIX, isValidPrefix } from '../services/prefix.service.js';
import { COLORS } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import type { Command } from './types.js';

type View = 'home' | 'bantin' | 'patch';

const BACK = new ButtonBuilder()
  .setCustomId(componentId('cfg', 'view', 'home'))
  .setLabel('Quay lại')
  .setEmoji('↩️')
  .setStyle(ButtonStyle.Secondary);

function homeEmbed(guildId: string, botName: string): EmbedBuilder {
  const c = reports.getConfig(guildId);
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('⚙️ Cài đặt sòng bạc trong server này')
    .setDescription('Mọi thứ admin chỉnh được đều nằm ở đây. Chọn một mục bên dưới.')
    .addFields(
      {
        name: '📰 Bản tin hằng ngày',
        value: [
          `${c.enabled ? 'Bật ✅' : 'Tắt ❌'} · ${c.hour}h giờ VN`,
          `Kênh: ${c.channelId ? `<#${c.channelId}>` : 'tự chọn kênh dùng bot nhiều nhất'}`,
          `Tag @everyone: ${c.tagEveryone ? 'có' : 'không'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🆕 Thông báo cập nhật',
        value: [
          c.patchEnabled ? 'Bật ✅' : 'Tắt ❌',
          `Kênh: ${c.patchChannelId ? `<#${c.patchChannelId}>` : 'dùng chung với bản tin'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '⌨️ Prefix lệnh nhắn',
        value:
          env.ENABLE_PREFIX_COMMANDS === 'true'
            ? `\`${prefixes.get(guildId)}\` · thử \`${prefixes.get(guildId)}tx 1k tai\``
            : `\`${prefixes.get(guildId)}\` (tính năng lệnh nhắn đang tắt)`,
        inline: true,
      },
      { name: '🏷️ Tên bot ở đây', value: botName, inline: true },
    );
}

function homeRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('cfg', 'view', 'bantin'))
        .setLabel('Bản tin')
        .setEmoji('📰')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(componentId('cfg', 'view', 'patch'))
        .setLabel('Cập nhật')
        .setEmoji('🆕')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(componentId('cfg', 'prefix'))
        .setLabel('Prefix')
        .setEmoji('⌨️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(componentId('cfg', 'ten'))
        .setLabel('Tên bot')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('qly', 'home'))
        .setLabel('Vật phẩm riêng của server')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Success),
    ),
  ];
}

function bantinView(guildId: string): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | ChannelSelectMenuBuilder>[];
} {
  const c = reports.getConfig(guildId);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('📰 Bản tin hằng ngày')
        .setDescription(
          [
            'Tổng kết top 10, thống kê 24h và jackpot, kèm nhận xét hóm hỉnh về từng người.',
            '',
            `Trạng thái: **${c.enabled ? 'Bật' : 'Tắt'}**`,
            `Giờ đăng: **${c.hour}h** (giờ VN)`,
            `Kênh: ${c.channelId ? `<#${c.channelId}>` : '**tự động**, chọn kênh dùng lệnh bot nhiều nhất'}`,
            `Tag @everyone: **${c.tagEveryone ? 'có' : 'không'}**`,
          ].join('\n'),
        ),
    ],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(componentId('cfg', 'kenh', 'bantin'))
          .setPlaceholder('Chọn kênh cố định để đăng bản tin')
          .addChannelTypes(ChannelType.GuildText),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('cfg', 'toggle', 'bantin'))
          .setLabel(c.enabled ? 'Tắt bản tin' : 'Bật bản tin')
          .setEmoji(c.enabled ? '🔕' : '🔔')
          .setStyle(c.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(componentId('cfg', 'gio'))
          .setLabel('Đổi giờ')
          .setEmoji('🕙')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(componentId('cfg', 'tudong', 'bantin'))
          .setLabel('Kênh tự động')
          .setEmoji('🎯')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!c.channelId),
        new ButtonBuilder()
          .setCustomId(componentId('cfg', 'tag'))
          .setLabel(c.tagEveryone ? 'Thôi tag everyone' : 'Tag everyone')
          .setEmoji('📣')
          .setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(BACK),
    ],
  };
}

function patchView(guildId: string): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | ChannelSelectMenuBuilder>[];
} {
  const c = reports.getConfig(guildId);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('🆕 Thông báo cập nhật')
        .setDescription(
          [
            'Mỗi lần bot lên phiên bản mới, nó tự đăng bản ghi chú thay đổi.',
            '',
            `Trạng thái: **${c.patchEnabled ? 'Bật' : 'Tắt'}**`,
            `Kênh: ${c.patchChannelId ? `<#${c.patchChannelId}>` : '**dùng chung** kênh với bản tin'}`,
            `Phiên bản đã thông báo: **${c.lastPatchVersion ?? 'chưa có'}**`,
          ].join('\n'),
        ),
    ],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(componentId('cfg', 'kenh', 'patch'))
          .setPlaceholder('Chọn kênh nhận thông báo cập nhật')
          .addChannelTypes(ChannelType.GuildText),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('cfg', 'toggle', 'patch'))
          .setLabel(c.patchEnabled ? 'Tắt thông báo' : 'Bật thông báo')
          .setEmoji(c.patchEnabled ? '🔕' : '🔔')
          .setStyle(c.patchEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(componentId('cfg', 'tudong', 'patch'))
          .setLabel('Dùng chung kênh bản tin')
          .setEmoji('🎯')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!c.patchChannelId),
        BACK,
      ),
    ],
  };
}

function render(
  view: View,
  guildId: string,
  botName: string,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | ChannelSelectMenuBuilder>[];
} {
  if (view === 'bantin') return bantinView(guildId);
  if (view === 'patch') return patchView(guildId);
  return { embeds: [homeEmbed(guildId, botName)], components: homeRows() };
}

/** Default permissions are server-editable, so re-check at every entry point. */
function mayConfigure(interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

export const caidatCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('caidat')
    .setDescription('Cài đặt bot trong server này: bản tin, cập nhật, prefix, tên bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'Bạn cần quyền Quản lý máy chủ để mở cài đặt.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      ...render('home', interaction.guildId, interaction.guild.members.me?.displayName ?? 'Casino'),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export const configComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    if (!interaction.inGuild() || !mayConfigure(interaction)) {
      await interaction.reply({
        content: 'Bạn cần quyền Quản lý máy chủ để đổi cài đặt.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const guildId = interaction.guildId;
    const [action, section] = args;
    const botName = interaction.guild?.members.me?.displayName ?? 'Casino';
    const back = (view: View): Promise<unknown> =>
      interaction.update(render(view, guildId, botName));

    if (action === 'view') {
      await back((section as View) ?? 'home');
      return;
    }
    if (action === 'toggle') {
      const c = reports.getConfig(guildId);
      if (section === 'bantin') reports.updateConfig(guildId, { enabled: !c.enabled });
      else reports.updateConfig(guildId, { patchEnabled: !c.patchEnabled });
      await back(section === 'bantin' ? 'bantin' : 'patch');
      return;
    }
    if (action === 'tudong') {
      if (section === 'bantin') reports.updateConfig(guildId, { channelId: null });
      else reports.updateConfig(guildId, { patchChannelId: null });
      await back(section === 'bantin' ? 'bantin' : 'patch');
      return;
    }
    if (action === 'tag') {
      const c = reports.getConfig(guildId);
      reports.updateConfig(guildId, { tagEveryone: !c.tagEveryone });
      await back('bantin');
      return;
    }
    if (action === 'gio') {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(componentId('cfg', 'set', 'gio'))
          .setTitle('Giờ đăng bản tin')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('giatri')
                .setLabel('Giờ (0-23, giờ Việt Nam)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(2),
            ),
          ),
      );
      return;
    }
    if (action === 'prefix') {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(componentId('cfg', 'set', 'prefix'))
          .setTitle('Prefix lệnh nhắn')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('giatri')
                .setLabel('Prefix mới')
                .setPlaceholder('1-5 ký tự, ví dụ: ! ? $ c!')
                .setValue(prefixes.get(guildId))
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(5),
            ),
          ),
      );
      return;
    }
    if (action === 'ten') {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(componentId('cfg', 'set', 'ten'))
          .setTitle('Tên hiển thị của bot')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('giatri')
                .setLabel('Tên mới (bỏ trống để trả về tên gốc)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(32),
            ),
          ),
      );
    }
  },

  async handleSelect(interaction: AnySelectMenuInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'kenh' || !interaction.isChannelSelectMenu() || !interaction.inGuild()) return;
    if (!mayConfigure(interaction)) {
      await interaction.reply({
        content: 'Bạn cần quyền Quản lý máy chủ để đổi cài đặt.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const channelId = interaction.values[0];
    if (args[1] === 'bantin') reports.updateConfig(interaction.guildId, { channelId });
    else reports.updateConfig(interaction.guildId, { patchChannelId: channelId });
    await interaction.update(
      render(
        args[1] === 'bantin' ? 'bantin' : 'patch',
        interaction.guildId,
        interaction.guild?.members.me?.displayName ?? 'Casino',
      ),
    );
  },

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'set' || !interaction.inGuild()) return;
    if (!mayConfigure(interaction)) {
      await interaction.reply({
        content: 'Bạn cần quyền Quản lý máy chủ để đổi cài đặt.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const guildId = interaction.guildId;
    const raw = interaction.fields.getTextInputValue('giatri').trim();
    const field = args[1];
    const complain = async (text: string): Promise<void> => {
      await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    };

    if (field === 'gio') {
      const hour = Number(raw);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        await complain('Giờ phải là số nguyên từ 0 đến 23.');
        return;
      }
      reports.updateConfig(guildId, { hour });
      await refresh(interaction, 'bantin');
      return;
    }

    if (field === 'prefix') {
      if (!isValidPrefix(raw)) {
        await complain(
          'Prefix không hợp lệ! Cần 1-5 ký tự, không khoảng trắng, không bắt đầu bằng `/`, không chứa `@` hoặc `#`.',
        );
        return;
      }
      prefixes.set(guildId, raw);
      await refresh(interaction, 'home');
      await interaction.followUp({
        content: `✅ Prefix của server này giờ là **\`${raw}\`**. Thử ngay: \`${raw}sodu\`, \`${raw}tx 100 tai\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (field === 'ten') {
      const me = interaction.guild?.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.ChangeNickname)) {
        await complain('Bot chưa có quyền **Change Nickname** trong server này, nhờ admin cấp giúp nhé!');
        return;
      }
      try {
        await me.setNickname(raw.length > 0 ? raw : null, `Đổi bởi ${interaction.user.tag}`);
      } catch (error) {
        console.error('[caidat] setNickname failed:', error);
        await complain('Đổi tên thất bại, có thể do thiếu quyền hoặc tên không hợp lệ.');
        return;
      }
      await refresh(interaction, 'home');
    }
  },
};

async function refresh(interaction: ModalSubmitInteraction, view: View): Promise<void> {
  if (!interaction.inGuild()) return;
  const payload = render(
    view,
    interaction.guildId,
    interaction.guild?.members.me?.displayName ?? 'Casino',
  );
  if (interaction.isFromMessage()) await interaction.update(payload);
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

export { DEFAULT_PREFIX };
