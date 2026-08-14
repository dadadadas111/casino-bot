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
        '`/lamviec` : cày 200-500 xu mỗi 10 phút, hết vốn thì đi làm chứ sao giờ',
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
        '`/trieuphu` : 15 câu hỏi, 30 giây mỗi câu, tối đa 50.000 xu, ngày một lần',
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
        '`/lamviec` : mỗi 10 phút một ca, 200-500 xu',
        '',
        '**Giữ**',
        '`/bank gui|rut|xem` : tiền trong két trộm không đụng được, nhưng muốn cược phải rút ra',
        '',
        '**Khoe và soi**',
        '`/sodu [nguoi]` : ví của bạn hoặc của người khác',
        '`/hoso [nguoi]` : hồ sơ đầy đủ, từ tài sản tới tiền án tiền sự và chuyện gia đình',
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
        '`/trom nguoi` : móc ví người khác, 40% ăn 12% ví họ (tối đa 5.000)',
        '`/nopphat` `/vienphi` : chuộc thân ra sớm, 1.000 xu cho lần đầu',
        '-# Ngồi tù 5 phút, nằm viện 3 phút 36 giây, lúc đó cấm tiệt chơi game và tiêu tiền.',
        '-# Tái phạm trong ngày thì phí nhân lên: lần 2 gấp đôi, lần 3 gấp ba... reset sau 24 giờ.',
        '',
        '**Mua sắm**',
        '`/shop` `/mua` `/tuido` `/dungdo` : xem hàng, xuống tiền, kiểm kê, xài đồ',
        '🛡️ Khiên (800) : chặn một lần bị trộm',
        '🪖 Mũ bảo hiểm (1.000) : trúng đạn cò quay vẫn khỏi nhập viện',
        '🍀 Bùa may mắn (1.000) : thắng ván nào cũng +10% tiền lời trong 1 giờ',
        '💍 Nhẫn cầu hôn (1.000) : để đi hỏi vợ hỏi chồng',
        '📦 Hộp quà (500) : mở ngay khi mua, hên xui',
        '☕ Cà phê (300) : xóa sạch cooldown làm việc',
        '🗝️ Chìa khóa (200) : thoát tù hoặc trốn viện, khỏi tốn tiền chuộc',
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
