export type QuizTier = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  question: string;
  answers: [string, string, string, string];
  correct: number; // index into answers (order is shuffled at runtime)
  tier: QuizTier;
}

export const QUESTIONS: QuizQuestion[] = [
  // ---- Easy (questions 1-5) ----
  { question: 'Thủ đô của Việt Nam là thành phố nào?', answers: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Huế'], correct: 0, tier: 'easy' },
  { question: 'Một tuần có bao nhiêu ngày?', answers: ['7', '5', '6', '8'], correct: 0, tier: 'easy' },
  { question: 'Ngôi sao trên quốc kỳ Việt Nam có màu gì?', answers: ['Vàng', 'Trắng', 'Đỏ', 'Xanh'], correct: 0, tier: 'easy' },
  { question: 'Con vật nào được mệnh danh là "chúa sơn lâm"?', answers: ['Hổ', 'Sư tử', 'Voi', 'Gấu'], correct: 0, tier: 'easy' },
  { question: 'Ở điều kiện thường, nước sôi ở bao nhiêu độ C?', answers: ['100', '90', '110', '80'], correct: 0, tier: 'easy' },
  { question: 'Tết Nguyên Đán được tính theo lịch nào?', answers: ['Âm lịch', 'Dương lịch', 'Lịch Maya', 'Lịch Julius'], correct: 0, tier: 'easy' },
  { question: 'Bánh chưng truyền thống có hình gì?', answers: ['Hình vuông', 'Hình tròn', 'Hình tam giác', 'Hình thoi'], correct: 0, tier: 'easy' },
  { question: '12 nhân 5 bằng bao nhiêu?', answers: ['60', '50', '55', '65'], correct: 0, tier: 'easy' },
  { question: 'Con sông nào chảy qua Hà Nội?', answers: ['Sông Hồng', 'Sông Hương', 'Sông Sài Gòn', 'Sông Mã'], correct: 0, tier: 'easy' },
  { question: 'Mặt trời mọc ở hướng nào?', answers: ['Đông', 'Tây', 'Nam', 'Bắc'], correct: 0, tier: 'easy' },
  { question: 'Phở là món ăn nổi tiếng của quốc gia nào?', answers: ['Việt Nam', 'Thái Lan', 'Nhật Bản', 'Hàn Quốc'], correct: 0, tier: 'easy' },
  { question: 'Một năm không nhuận có bao nhiêu ngày?', answers: ['365', '364', '366', '360'], correct: 0, tier: 'easy' },
  { question: 'Trái Đất quay quanh thiên thể nào?', answers: ['Mặt Trời', 'Mặt Trăng', 'Sao Hỏa', 'Sao Kim'], correct: 0, tier: 'easy' },
  { question: 'Hình tam giác có bao nhiêu cạnh?', answers: ['3', '2', '4', '5'], correct: 0, tier: 'easy' },
  { question: 'Áo dài là trang phục truyền thống của quốc gia nào?', answers: ['Việt Nam', 'Trung Quốc', 'Nhật Bản', 'Ấn Độ'], correct: 0, tier: 'easy' },
  { question: 'Đèn giao thông màu nào báo hiệu phải dừng lại?', answers: ['Đỏ', 'Xanh', 'Vàng', 'Tím'], correct: 0, tier: 'easy' },
  { question: 'Con vật nào kêu "meo meo"?', answers: ['Mèo', 'Chó', 'Gà', 'Vịt'], correct: 0, tier: 'easy' },
  { question: 'Ai là tác giả của Truyện Kiều?', answers: ['Nguyễn Du', 'Nguyễn Trãi', 'Hồ Xuân Hương', 'Nguyễn Bỉnh Khiêm'], correct: 0, tier: 'easy' },
  { question: 'Vạn Lý Trường Thành nằm ở quốc gia nào?', answers: ['Trung Quốc', 'Nhật Bản', 'Hàn Quốc', 'Mông Cổ'], correct: 0, tier: 'easy' },
  { question: 'Nốt nào đứng đầu trong 7 nốt nhạc cơ bản?', answers: ['Đô', 'Rê', 'Mi', 'Fa'], correct: 0, tier: 'easy' },

  // ---- Medium (questions 6-10) ----
  { question: 'Đỉnh núi cao nhất Việt Nam là đỉnh nào?', answers: ['Fansipan', 'Bạch Mã', 'Bà Đen', 'Lang Biang'], correct: 0, tier: 'medium' },
  { question: 'Vịnh Hạ Long thuộc tỉnh nào?', answers: ['Quảng Ninh', 'Hải Phòng', 'Thanh Hóa', 'Khánh Hòa'], correct: 0, tier: 'medium' },
  { question: 'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?', answers: ['1954', '1945', '1968', '1975'], correct: 0, tier: 'medium' },
  { question: 'Ai đọc bản Tuyên ngôn Độc lập khai sinh nước Việt Nam Dân chủ Cộng hòa?', answers: ['Hồ Chí Minh', 'Võ Nguyên Giáp', 'Phạm Văn Đồng', 'Trường Chinh'], correct: 0, tier: 'medium' },
  { question: 'Nhạc sĩ nào sáng tác Quốc ca Việt Nam (Tiến quân ca)?', answers: ['Văn Cao', 'Trịnh Công Sơn', 'Phạm Duy', 'Đỗ Nhuận'], correct: 0, tier: 'medium' },
  { question: 'Hành tinh lớn nhất trong Hệ Mặt Trời?', answers: ['Sao Mộc', 'Sao Thổ', 'Trái Đất', 'Sao Hải Vương'], correct: 0, tier: 'medium' },
  { question: 'Ai là tác giả "Dế Mèn phiêu lưu ký"?', answers: ['Tô Hoài', 'Nam Cao', 'Ngô Tất Tố', 'Nguyễn Nhật Ánh'], correct: 0, tier: 'medium' },
  { question: 'Thành phố nào của Việt Nam từng mang tên Sài Gòn?', answers: ['TP. Hồ Chí Minh', 'Cần Thơ', 'Biên Hòa', 'Vũng Tàu'], correct: 0, tier: 'medium' },
  { question: 'Quốc gia nào có diện tích lớn nhất thế giới?', answers: ['Nga', 'Canada', 'Trung Quốc', 'Mỹ'], correct: 0, tier: 'medium' },
  { question: 'Quần thể kim tự tháp Giza nằm ở quốc gia nào?', answers: ['Ai Cập', 'Mexico', 'Peru', 'Sudan'], correct: 0, tier: 'medium' },
  { question: 'Ai là người đầu tiên đặt chân lên Mặt Trăng?', answers: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'], correct: 0, tier: 'medium' },
  { question: 'Sông Mê Kông khi chảy vào Việt Nam được gọi là sông gì?', answers: ['Sông Cửu Long', 'Sông Đồng Nai', 'Sông Ba', 'Sông Mã'], correct: 0, tier: 'medium' },
  { question: 'Vị vua nào dời đô từ Hoa Lư về Thăng Long?', answers: ['Lý Thái Tổ', 'Đinh Tiên Hoàng', 'Lê Đại Hành', 'Trần Thái Tông'], correct: 0, tier: 'medium' },
  { question: 'Châu lục nào có diện tích lớn nhất?', answers: ['Châu Á', 'Châu Phi', 'Châu Mỹ', 'Châu Âu'], correct: 0, tier: 'medium' },
  { question: 'Huế là kinh đô của triều đại phong kiến nào?', answers: ['Nhà Nguyễn', 'Nhà Lê', 'Nhà Trần', 'Nhà Lý'], correct: 0, tier: 'medium' },
  { question: 'Đội tuyển bóng đá nam Việt Nam vô địch AFF Cup lần đầu vào năm nào?', answers: ['2008', '2018', '2004', '1998'], correct: 0, tier: 'medium' },
  { question: 'Loài hoa nào thường được coi là quốc hoa của Việt Nam?', answers: ['Hoa sen', 'Hoa đào', 'Hoa mai', 'Hoa hồng'], correct: 0, tier: 'medium' },
  { question: 'Nguyên tố hóa học có ký hiệu O là gì?', answers: ['Oxy', 'Vàng', 'Osmi', 'Bạc'], correct: 0, tier: 'medium' },
  { question: 'World Cup 2022 được tổ chức tại quốc gia nào?', answers: ['Qatar', 'Nga', 'Brazil', 'Đức'], correct: 0, tier: 'medium' },
  { question: 'Quốc gia nào đông dân nhất thế giới hiện nay?', answers: ['Ấn Độ', 'Trung Quốc', 'Mỹ', 'Indonesia'], correct: 0, tier: 'medium' },

  // ---- Hard (questions 11-15) ----
  { question: 'Trận Bạch Đằng năm 938 do ai chỉ huy?', answers: ['Ngô Quyền', 'Trần Hưng Đạo', 'Lê Lợi', 'Lý Thường Kiệt'], correct: 0, tier: 'hard' },
  { question: 'Lý Thái Tổ dời đô về Thăng Long vào năm nào?', answers: ['1010', '1009', '1054', '1225'], correct: 0, tier: 'hard' },
  { question: 'Tác phẩm "Chí Phèo" là của nhà văn nào?', answers: ['Nam Cao', 'Vũ Trọng Phụng', 'Ngô Tất Tố', 'Nguyễn Công Hoan'], correct: 0, tier: 'hard' },
  { question: 'Tiểu thuyết "Số đỏ" là của nhà văn nào?', answers: ['Vũ Trọng Phụng', 'Nam Cao', 'Nguyễn Tuân', 'Thạch Lam'], correct: 0, tier: 'hard' },
  { question: 'Quốc gia nào có biên giới giáp cả Việt Nam, Trung Quốc và Campuchia?', answers: ['Lào', 'Thái Lan', 'Myanmar', 'Malaysia'], correct: 0, tier: 'hard' },
  { question: 'Đơn vị đo tần số là gì?', answers: ['Hertz', 'Watt', 'Joule', 'Pascal'], correct: 0, tier: 'hard' },
  { question: 'Thuyết tương đối là công trình nổi tiếng của nhà khoa học nào?', answers: ['Albert Einstein', 'Isaac Newton', 'Stephen Hawking', 'Galileo Galilei'], correct: 0, tier: 'hard' },
  { question: 'Nguyên tố hóa học có ký hiệu Fe là gì?', answers: ['Sắt', 'Đồng', 'Chì', 'Kẽm'], correct: 0, tier: 'hard' },
  { question: 'Thủ đô của Úc (Australia) là thành phố nào?', answers: ['Canberra', 'Sydney', 'Melbourne', 'Perth'], correct: 0, tier: 'hard' },
  { question: 'Thủ đô của Canada là thành phố nào?', answers: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'], correct: 0, tier: 'hard' },
  { question: 'Nguyên tố nào phổ biến nhất trong vũ trụ?', answers: ['Hydro', 'Heli', 'Oxy', 'Carbon'], correct: 0, tier: 'hard' },
  { question: 'Tháp Eiffel được khánh thành vào năm nào?', answers: ['1889', '1875', '1900', '1850'], correct: 0, tier: 'hard' },
  { question: 'Chiến dịch Hồ Chí Minh kết thúc vào ngày nào?', answers: ['30/4/1975', '2/9/1945', '7/5/1954', '27/1/1973'], correct: 0, tier: 'hard' },
  { question: 'Loài chim nào chạy nhanh nhất thế giới?', answers: ['Đà điểu', 'Cánh cụt', 'Gà tây', 'Công'], correct: 0, tier: 'hard' },
  { question: 'Ai là cha đẻ của ba định luật chuyển động trong vật lý cổ điển?', answers: ['Isaac Newton', 'Albert Einstein', 'Nikola Tesla', 'Michael Faraday'], correct: 0, tier: 'hard' },
  { question: 'Tên gọi "Cửu Long" của đồng bằng sông Cửu Long ứng với bao nhiêu cửa sông?', answers: ['9', '7', '8', '10'], correct: 0, tier: 'hard' },
  { question: 'Văn Miếu - Quốc Tử Giám được xây dựng dưới triều đại nào?', answers: ['Nhà Lý', 'Nhà Trần', 'Nhà Lê', 'Nhà Nguyễn'], correct: 0, tier: 'hard' },
  { question: 'Ai là tổng thống đầu tiên của Hoa Kỳ?', answers: ['George Washington', 'Abraham Lincoln', 'Thomas Jefferson', 'John Adams'], correct: 0, tier: 'hard' },
  { question: 'Ánh sáng đi từ Mặt Trời đến Trái Đất mất khoảng bao lâu?', answers: ['8 phút', '8 giây', '8 giờ', '1 phút'], correct: 0, tier: 'hard' },
  { question: 'Quốc gia Đông Nam Á nào không giáp biển?', answers: ['Lào', 'Campuchia', 'Thái Lan', 'Myanmar'], correct: 0, tier: 'hard' },
];
