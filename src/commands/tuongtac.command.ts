import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { fetchActionGif } from '../services/gif.service.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

interface ActionDef {
  name: string;
  category: string; // nekos.best category
  description: string;
  templates: string[]; // {a} = actor, {b} = target
  selfText: string;
  color: number;
}

const ACTIONS: ActionDef[] = [
  {
    name: 'danh',
    category: 'slap',
    description: 'Bực quá thì cho một cú (kèm GIF)',
    templates: [
      '💢 **{a}** cho **{b}** một cú trời giáng!',
      '👊 **{a}** tung chưởng, **{b}** không kịp né!',
      '🥊 **{a}** đánh **{b}** một phát đau điếng!',
    ],
    selfText: '🤕 **{a}** tự đánh mình... bình tĩnh lại nào!',
    color: COLORS.lose,
  },
  {
    name: 'om',
    category: 'hug',
    description: 'Ôm một người thật chặt (kèm GIF)',
    templates: [
      '🤗 **{a}** ôm **{b}** thật chặt!',
      '🫂 **{a}** dang tay ôm lấy **{b}**, ấm áp ghê!',
    ],
    selfText: '🥺 **{a}** tự ôm mình... ai đó ôm bạn ấy đi!',
    color: COLORS.win,
  },
  {
    name: 'hon',
    category: 'kiss',
    description: 'Yêu thì hôn một cái (kèm GIF)',
    templates: [
      '😘 **{a}** hôn **{b}** một cái thật kêu!',
      '💋 **{a}** thơm má **{b}**, ngọt ngào quá!',
    ],
    selfText: '😳 **{a}** gửi nụ hôn cho... chính mình!',
    color: COLORS.gold,
  },
  {
    name: 'choc',
    category: 'poke',
    description: 'Chọc ghẹo cho đỡ chán (kèm GIF)',
    templates: [
      '👉 **{a}** chọc chọc **{b}**, phiền ghê!',
      '😜 **{a}** lén chọc **{b}** rồi giả vờ vô tội!',
    ],
    selfText: '🤨 **{a}** tự chọc mình, rảnh quá rồi!',
    color: COLORS.info,
  },
  {
    name: 'xoadau',
    category: 'pat',
    description: 'Xoa đầu khen ngoan (kèm GIF)',
    templates: [
      '🥰 **{a}** xoa đầu **{b}**, ngoan lắm!',
      '😊 **{a}** vỗ về **{b}**, dễ thương chưa kìa!',
    ],
    selfText: '😌 **{a}** tự xoa đầu tự khen mình ngoan!',
    color: COLORS.playing,
  },
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildCommand(def: ActionDef): Command {
  return {
    data: new SlashCommandBuilder()
      .setName(def.name)
      .setDescription(def.description)
      .addUserOption((o) =>
        o.setName('nguoi').setDescription('Người bạn muốn tương tác').setRequired(true),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const target = interaction.options.getUser('nguoi', true);
      const isSelf = target.id === interaction.user.id;

      // GIF fetch can take a moment; defer to stay inside the 3s window.
      await interaction.deferReply();
      const gif = await fetchActionGif(def.category);

      const template = isSelf ? def.selfText : pick(def.templates);
      const text = template
        .replaceAll('{a}', interaction.user.displayName)
        .replaceAll('{b}', target.displayName);

      const embed = new EmbedBuilder().setColor(def.color).setDescription(text);
      if (gif) embed.setImage(gif);

      await interaction.editReply({
        content: isSelf || target.bot ? undefined : `<@${target.id}>`,
        embeds: [embed],
        allowedMentions: { users: isSelf || target.bot ? [] : [target.id] },
      });
    },
  };
}

export const tuongtacCommands: Command[] = ACTIONS.map(buildCommand);
