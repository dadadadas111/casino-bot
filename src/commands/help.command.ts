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
        '`/lamviec` : đi làm mỗi 10 phút. Làm nhiều ca thì lên chức, lương tăng dần',
        '`/vi` : ví, két, tiền nạp, vay nợ và lịch sử, gộp chung một bảng có nút',
        '',
        '**Cháy túi rồi?** `/xoso so:42` mua vé 100 xu ôm mộng jackpot, hoặc ngửa tay xin `/chuyentien` từ bạn bè.',
        '',
        '**Ngại lục lệnh?** `/sanh` mở một bảng nút cho mọi trò. Ghim nó vào kênh là cả server khỏi gõ lệnh nữa.',
        '',
        'Bấm các nút bên dưới để xem chi tiết từng mảng.',
      ].join('\n'),
  },
  {
    key: 'games',
    label: 'Trò chơi',
    emoji: '🎮',
    title: '🎮 Sòng bạc có gì chơi',
    body: (prefix) =>
      [
        '`/blackjack cuoc` : đấu bài nhà cái, blackjack trả 3:2, có nút rút/dừng/gấp đôi (gõ tắt `/bj`)',
        '`/taixiu cuoc chon` : lắc 3 xúc xắc, ra bão là nhà cái ăn',
        '`/baucua cuoc chon` : mỗi mặt trúng ăn 1:1',
        '`/slots cuoc` : máy xèng, hai hình cao (🔔⭐💎7️⃣) đã ăn x2, 7️⃣7️⃣7️⃣ ăn x100',
        '`/hilo cuoc` : lật lá bài, đoán lá kế cao hay thấp. Đoán đúng thì nhân tiền, rút lúc nào cũng được',
        '`/domin cuoc` : 3 quả mìn giấu trong 16 ô, mở được ô nào ăn ô đó, tham quá thì mất sạch',
        '`/coquay cuoc` : cò quay Nga từ 2 người, ai dính đạn thì nằm viện, người sống chia tiền',
        '`/duangua` : mở trường đua, cả kênh đặt cửa theo tỷ lệ, ngựa chạy trực tiếp',
        '`/trieuphu` : 15 câu hỏi, 30 giây mỗi câu, tối đa 100.000 xu, chơi lại sau 15 phút',
        '`/xoso so` : vé số 00-99, quay 21h mỗi tối, trúng là ẵm cả hũ. Bỏ trống `so` để xem hũ đang bao nhiêu',
        '',
        `-# Gõ nhanh không cần slash: \`${prefix}tx 1k tai\`, \`${prefix}bc 500 ga\`, \`${prefix}sl 200\`, \`${prefix}dn\`, \`${prefix}xs 42\``,
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
        '`/daily` : điểm danh, chuỗi liên tục càng dài thưởng càng cao. Có nhà thì được cộng thêm',
        '`/lamviec` : đi làm theo ca. Càng nhiều ca càng lên chức, từ 🧹 Chạy vặt tới 🏦 Chủ tịch',
        '-# Chức càng cao lương càng cao: Chạy vặt 200-500, Chủ tịch 2.000-3.500 mỗi ca.',
        '-# 🏦 Lên Chủ tịch thì một nửa số ca là quyết định điều hành: chọn đúng ăn đậm, chọn liều có thể phá sản mất chức.',
        '',
        '**Vay nóng** (nút 💰 trong `/vi`)',
        'Hạn mức tuỳ uy tín: chức càng cao, tài sản càng nhiều thì vay được càng lớn.',
        'Lãi 20% cho 24 giờ. Quá hạn mỗi giờ cộng thêm 5%.',
        '-# Chây ì quá thì chủ nợ siết ví, siết két, tịch thu cả nhà xe, rồi tống vào tù.',
        '-# `/doino @ai đó` để đi đòi nợ người khác: không lấy được xu nào, nhưng nhục thì có.',
        '',
        '**`/vi` : một bảng lo hết**',
        'Xem ví, két và tiền nạp cùng lúc, rồi bấm nút để gửi két, rút két, đổi tiền nạp ra xu, nạp thêm, xem lịch sử.',
        '-# Tiền trong két thì trộm không đụng được, nhưng muốn cược phải rút ra.',
        '-# Nhập số kiểu gì cũng hiểu: `1k` = 1.000, `2m` = 2 triệu, `all`, `half`.',
        '',
        '**Khoe và soi**',
        '`/sodu [nguoi]` : lối tắt vào ví, có kèm tên ai đó thì xem ví người ta',
        '`/hoso [nguoi]` : hồ sơ đầy đủ, từ tài sản tới tiền án tiền sự và chuyện gia đình',
        '`/top` : bảng xếp hạng đại gia trong server',
        '`/chuyentien nguoi soxu` : chuyển xu, hào phóng hay hối lộ tùy bạn',
        '',
        '**Tiền nạp** 💵',
        '`/nap sotien` : quét QR chuyển khoản (tối thiểu 10.000đ), vài giây sau tiền vào ví',
        '-# Đổi ra xu trong `/vi`, 1đ ăn 20 xu.',
        '-# Tiền chỉ đi một chiều, xu không đổi ngược ra tiền thật.',
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
        '-# Trộm hụt là đi tù 5 phút, trúng đạn cò quay là nằm viện 3 phút 36. Lúc đó cấm chơi game và tiêu tiền.',
        '-# Muốn ra sớm thì bấm nút **Nộp phạt** / **Trả viện phí** ngay trong tin nhắn chặn bạn, hoặc mở `/hoso`.',
        '-# Tái phạm trong ngày thì phí nhân lên: lần 2 gấp đôi, lần 3 gấp ba, reset sau 24 giờ.',
        '',
        '**`/tuido` : túi đồ và cửa hàng chung một bảng**',
        'Đổi qua lại hai thẻ 🎒 Túi đồ và 🏪 Cửa hàng, chọn món rồi bấm Mua, Dùng hoặc Tặng.',
        '🛡️ Khiên (800) : chặn một lần bị trộm',
        '🪖 Mũ bảo hiểm (1.000) : trúng đạn cò quay vẫn khỏi nhập viện',
        '🍀 Bùa may mắn (1.000) : thắng ván nào cũng +10% tiền lời trong 1 giờ',
        '💍 Nhẫn cầu hôn (1.000) : để đi hỏi vợ hỏi chồng',
        '📦 Hộp quà (500) : mở ngay khi mua, hên xui',
        '☕ Cà phê (300) : xóa sạch cooldown làm việc',
        '🗝️ Chìa khóa (200) : thoát tù hoặc trốn viện, khỏi tốn tiền chuộc',
        '🎎 Hình nộm (1.000) : bạn tưởng tượng, tự đặt tên và cưới được luôn',
        '🏷️ Thẻ đổi tên (200) : đổi tên hoặc đổi hình cho hình nộm',
        '-# Mua nhiều cái một lúc: nút 🧺 Mua nhiều trong `/tuido`, hoặc gõ `!mua mubaohiem 3`.',
        '-# `/shop` vẫn dùng được, nó mở thẳng vào thẻ cửa hàng.',
        '',
        '**Tài sản lớn** (thẻ 🏠 trong `/tuido`)',
        '🏚️🏠🏡🏰 Nhà (20.000 tới 1.500.000) : điểm danh cộng thêm 10% tới 100%',
        '🛵🚗🏎️ Xe (30.000 tới 600.000) : rút thời gian chờ làm việc từ 10 phút xuống 4',
        '🐶 Chó (25.000) : 20% đuổi được trộm, không vỡ như khiên',
        '🐱 Mèo (25.000) : mỗi ngày tha xu về, nhận cùng lúc điểm danh',
        '🦜 Vẹt (80.000) : thêm một lượt 50:50 trong Ai Là Triệu Phú',
        '-# Mỗi loại giữ một món. Lên đời thì món cũ được thu lại nửa giá.',
        '',
        '**Chuyện đôi lứa**',
        '`/cuoi nguoi` : quỳ gối cầu hôn, nhớ mua 💍 trước kẻo quê',
        '`/cuoi` : bỏ trống thì mở bảng gia đình, có nút 💒 Tổ chức hôn lễ và 💔 Ly hôn',
        '`/hinhnom` : tạo, đổi tên, cưới hoặc vứt người bạn tưởng tượng, tất cả bằng nút',
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
        '`/doino nguoi` : dí nợ một con nợ, càng đòi nhiều lần càng ầm ĩ',
        '',
        '**Xem tin**',
        '`/bantin` : báo cáo sòng bạc, top 10 và ai đang thắng đậm thua đau',
        '`/patchnote` : bot vừa thêm trò gì mới',
        '',
        '**Cho admin server** (cần quyền Quản lý máy chủ)',
        '`/caidat` : một cửa duy nhất cho bản tin, thông báo cập nhật, prefix và tên bot',
        '-# Chỉnh xu của người chơi là việc của chủ bot, admin server không có quyền này. Xu dùng chung cho mọi server nên không thể để mỗi nơi tự in tiền.',
        '',
        env.ENABLE_PREFIX_COMMANDS === 'true'
          ? `**Gõ nhanh không cần slash**\nGõ mỗi \`${prefix}\` là mở bảng chọn. Hoặc: \`${prefix}tx 1k tai\` · \`${prefix}sl all\` · \`${prefix}dn\` · \`${prefix}sodu\` · \`${prefix}daily\` · \`${prefix}work\`\n-# Mẹo: \`1k\`=1.000, \`all\`=tất tay, \`half\`=nửa ví. Bỏ trống tiền cược thì lặp lại lần trước.`
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

/** The first help page plus its tab buttons, reusable from the lobby. */
export function helpPanel(guildId: string | null): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const prefix = prefixFor(guildId);
  return { embeds: [pageEmbed(PAGES[0], prefix)], components: pageButtons(PAGES[0].key) };
}

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hướng dẫn chơi và danh sách lệnh'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      ...helpPanel(interaction.inGuild() ? interaction.guildId : null),
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
