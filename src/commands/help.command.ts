import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { env } from '../config/env.js';
import { prefixes } from '../context.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

interface HelpPage {
  key: string;
  label: string;
  emoji: string;
  title: string;
  body: (prefix: string) => string;
}

const PAGES: HelpPage[] = [
  {
    key: 'start',
    label: 'Bắt đầu',
    emoji: '🏠',
    title: '🎰 Chào mừng tới sòng bạc!',
    body: () =>
      [
        'Tân thủ được tặng **1.000 xu** miễn phí. Xu chỉ để chơi vui, không có giá trị thật.',
        '',
        '**Ba lệnh sống còn**',
        '`/daily` : điểm danh nhận 500 xu mỗi ngày, chăm thì lên 1.000',
        '`/lamviec` : cày 100-300 xu mỗi giờ, hết vốn thì đi làm chứ sao giờ',
        '`/sodu` : xem ví, két, tình duyên và án tù của bạn',
        '',
        '**Cháy túi rồi?** `/xoso mua` vé 100 xu ôm mộng jackpot, hoặc ngửa tay xin `/chuyentien` từ bạn bè.',
        '',
        'Bấm các nút bên dưới để xem chi tiết từng mảng.',
      ].join('\n'),
  },
  {
    key: 'games',
    label: 'Trò chơi',
    emoji: '🎮',
    title: '🎮 Sòng bạc có gì chơi',
    body: () =>
      [
        '`/blackjack cuoc` : đấu bài nhà cái, blackjack trả 3:2, có nút rút/dừng/gấp đôi',
        '`/taixiu cuoc chon` : lắc 3 xúc xắc, ra bão là nhà cái ăn',
        '`/baucua cuoc chon` : mỗi mặt trúng ăn 1:1',
        '`/coinflip cuoc chon` : ngửa hay sấp, 50/50 sòng phẳng',
        '`/slots cuoc` : máy xèng, 7️⃣7️⃣7️⃣ ăn x100',
        '`/keo nguoi cuoc` : thách solo 1v1, ai thắng ăn cả',
        '`/coquay cuoc` : cò quay Nga từ 2 người, ai dính đạn thì nằm viện, người sống chia tiền',
        '`/duangua` : mở trường đua, cả kênh đặt cửa theo tỷ lệ, ngựa chạy trực tiếp',
        '`/trieuphu` : 15 câu hỏi, 30 giây mỗi câu, tối đa 100.000 xu, ngày một lần',
        '`/xoso mua so` : vé số 00-99, quay 21h mỗi tối, không ai trúng thì hũ dồn',
        '',
        '-# Viết tắt cho người bận rộn: `/bj` `/tx` `/bc` `/cf`',
      ].join('\n'),
  },
  {
    key: 'money',
    label: 'Tiền bạc',
    emoji: '💰',
    title: '💰 Kiếm tiền, giữ tiền, khoe tiền',
    body: () =>
      [
        '**Kiếm**',
        '`/daily` : điểm danh, chuỗi liên tục càng dài thưởng càng cao (tối đa 1.000)',
        '`/lamviec` : mỗi giờ một ca, 100-300 xu',
        '',
        '**Giữ**',
        '`/bank gui|rut|xem` : tiền trong két trộm không đụng được, nhưng muốn cược phải rút ra',
        '',
        '**Khoe và soi**',
        '`/sodu [nguoi]` : ví của bạn hoặc của người khác',
        '`/lichsu [nguoi]` : từng đồng ra vào, ai nướng tiền vào đâu lộ hết',
        '`/top` : bảng xếp hạng đại gia',
        '`/chuyentien nguoi soxu` : chuyển xu, hào phóng hay hối lộ tùy bạn',
        '',
        '**Tiền nạp** 💵',
        '`/nap sotien` : quét QR chuyển khoản (tối thiểu 10.000đ), vài giây sau tiền vào ví',
        '`/cash xem` : xem ví tiền nạp',
        '`/cash doixu sotien` : đổi tiền nạp sang xu, 1đ ăn 20 xu',
        '-# Reset ghế nóng Triệu Phú chỉ 500đ. Tiền chỉ đi một chiều, xu không đổi ngược ra tiền thật.',
      ].join('\n'),
  },
  {
    key: 'life',
    label: 'Đời sống',
    emoji: '🏙️',
    title: '🏙️ Ngoài sòng bạc vẫn còn cuộc đời',
    body: () =>
      [
        '**Làm ăn phi pháp**',
        '`/trom nguoi` : móc ví người khác, 40% ăn 15% ví họ',
        '`/nopphat` : chi 100 xu ra tù sớm',
        '`/vienphi` : chi 100 xu xuất viện sớm sau khi trúng đạn cò quay',
        '-# Ngồi tù 5 phút, nằm viện 3 phút 36 giây, lúc đó cấm tiệt chơi game và tiêu tiền.',
        '',
        '**Mua sắm**',
        '`/shop` `/mua` `/tuido` `/dungdo` : xem hàng, xuống tiền, kiểm kê, xài đồ',
        '🛡️ Khiên : chặn một lần bị trộm',
        '🍀 Bùa may mắn : thắng ván nào cũng +10% tiền lời trong 1 giờ',
        '☕ Cà phê : xóa sạch cooldown làm việc',
        '🗝️ Chìa khóa : vượt ngục miễn phí',
        '📦 Hộp quà : mở ngay khi mua, hên xui',
        '',
        '**Chuyện đôi lứa**',
        '`/cauhon nguoi` : quỳ gối cầu hôn, nhớ mua 💍 trước kẻo quê',
        '`/honle` : mở tiệc cưới, khách mừng tiền hoặc bấm nút ăn chực',
        '`/lyhon` : hết duyên thì đường ai nấy đi, phí 1.000 xu',
      ].join('\n'),
  },
  {
    key: 'misc',
    label: 'Linh tinh',
    emoji: '🎭',
    title: '🎭 Mấy thứ còn lại',
    body: (prefix) =>
      [
        '**Đùa giỡn** (kèm GIF)',
        '`/om` `/hon` `/danh` `/choc` `/xoadau` `nguoi` : bày tỏ tình cảm hoặc nắm đấm',
        '',
        '**Bản tin & cập nhật**',
        '`/bantin xem` : báo cáo sòng bạc, top 10 và ai đang thắng đậm thua đau',
        '-# Tự đăng 10h sáng mỗi ngày. Admin chỉnh bằng `/bantin config`.',
        '`/patchnote xem` : bot vừa thêm trò gì mới',
        '-# Tự báo mỗi lần bot lên bản mới, tắt bằng `/patchnote config`.',
        '',
        '**Cho admin server**',
        '`/setprefix` : đổi prefix lệnh nhắn (hiện tại: `' + prefix + '`)',
        '`/doiten ten` : đổi tên hiển thị của bot trong server',
        '`/casino-admin cong|tru|dat` : chỉnh xu cho người chơi (tối đa 10.000 mỗi lần)',
        '',
        env.ENABLE_PREFIX_COMMANDS === 'true'
          ? `**Gõ nhanh không cần slash**\n\`${prefix}tx 1k tai\` · \`${prefix}sl all\` · \`${prefix}dn\` · \`${prefix}sodu\` · \`${prefix}daily\`\n-# Mẹo: \`1k\`=1.000, \`all\`=tất tay, \`half\`=nửa ví. Bỏ trống tiền cược thì lặp lại lần trước.`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
  },
];

function pageEmbed(page: HelpPage, prefix: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(page.title)
    .setDescription(page.body(prefix))
    .setFooter({ text: 'Chơi vui thôi, xu này mua mì tôm không được đâu.' });
}

function pageButtons(activeKey: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      PAGES.map((p) =>
        new ButtonBuilder()
          .setCustomId(componentId('help', p.key))
          .setLabel(p.label)
          .setEmoji(p.emoji)
          .setStyle(p.key === activeKey ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(p.key === activeKey),
      ),
    ),
  ];
}

function prefixFor(guildId: string | null): string {
  return guildId ? prefixes.get(guildId) : '!';
}

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hướng dẫn chơi và danh sách lệnh'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const prefix = prefixFor(interaction.inGuild() ? interaction.guildId : null);
    await interaction.reply({
      embeds: [pageEmbed(PAGES[0], prefix)],
      components: pageButtons(PAGES[0].key),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export const helpComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const page = PAGES.find((p) => p.key === args[0]);
    if (!page) return;
    const prefix = prefixFor(interaction.inGuild() ? interaction.guildId : null);
    await interaction.update({
      embeds: [pageEmbed(page, prefix)],
      components: pageButtons(page.key),
    });
  },
};
