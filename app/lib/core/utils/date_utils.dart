/// 日期工具類 - 統一的日期計算與格式化邏輯
///
/// 避免不同頁面使用不一致的日期計算邏輯，統一在此處理。
library;

/// 日期工具類
class DateUtils {
  DateUtils._(); // 私有構造函數，防止實例化

  /// 計算兩個日期之間的整天數差異
  ///
  /// 會先將日期標準化為午夜（去除時分秒），再計算天數差異。
  /// 這樣可以避免 `.inDays` 無條件捨去小數導致的錯誤。
  ///
  /// 範例：
  /// ```dart
  /// final now = DateTime(2026, 2, 7, 23, 0);  // 2026-02-07 23:00
  /// final due = DateTime(2026, 2, 12, 8, 0);  // 2026-02-12 08:00
  /// final days = DateUtils.daysBetween(now, due);  // 返回 5（正確）
  /// ```
  ///
  /// 如果直接使用 `due.difference(now).inDays`，會得到 4（錯誤）。
  static int daysBetween(DateTime from, DateTime to) {
    final fromDate = DateTime(from.year, from.month, from.day);
    final toDate = DateTime(to.year, to.month, to.day);
    return toDate.difference(fromDate).inDays;
  }

  /// 格式化截止日期為人類可讀的文字
  ///
  /// 參數：
  /// - [dueDate]: 截止日期
  /// - [referenceDate]: 參考日期（默認為當前時間）
  ///
  /// 返回：
  /// - 逾期：「逾期 X 天」
  /// - 今天：「今天」
  /// - 明天：「明天」
  /// - 7天內：「X 天後」
  /// - 7天以上：「M/D」格式
  ///
  /// 範例：
  /// ```dart
  /// final dueDate = DateTime(2026, 2, 10);
  /// final text = DateUtils.formatDueDate(dueDate);  // 「3 天後」
  /// ```
  static String formatDueDate(DateTime dueDate, {DateTime? referenceDate}) {
    final now = referenceDate ?? DateTime.now();
    final diff = daysBetween(now, dueDate);

    if (diff < 0) return '逾期 ${-diff} 天';
    if (diff == 0) return '今天';
    if (diff == 1) return '明天';
    if (diff < 7) return '$diff 天後';
    return '${dueDate.month}/${dueDate.day}';
  }

  /// 檢查給定日期是否為今天
  ///
  /// 參數：
  /// - [date]: 要檢查的日期
  /// - [referenceDate]: 參考日期（默認為當前時間）
  ///
  /// 範例：
  /// ```dart
  /// final date = DateTime.now();
  /// final isToday = DateUtils.isToday(date);  // true
  /// ```
  static bool isToday(DateTime date, {DateTime? referenceDate}) {
    final now = referenceDate ?? DateTime.now();
    return daysBetween(now, date) == 0;
  }

  /// 檢查給定日期是否為明天
  static bool isTomorrow(DateTime date, {DateTime? referenceDate}) {
    final now = referenceDate ?? DateTime.now();
    return daysBetween(now, date) == 1;
  }

  /// 檢查給定日期是否已過期
  static bool isOverdue(DateTime date, {DateTime? referenceDate}) {
    final now = referenceDate ?? DateTime.now();
    return daysBetween(now, date) < 0;
  }

  /// 取得今天的午夜時間（00:00:00）
  ///
  /// 範例：
  /// ```dart
  /// final midnight = DateUtils.todayMidnight();  // 2026-02-07 00:00:00
  /// ```
  static DateTime todayMidnight({DateTime? referenceDate}) {
    final now = referenceDate ?? DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  /// 取得明天的午夜時間（00:00:00）
  static DateTime tomorrowMidnight({DateTime? referenceDate}) {
    final midnight = todayMidnight(referenceDate: referenceDate);
    return midnight.add(const Duration(days: 1));
  }

  /// 格式化日期為「YYYY-MM-DD」格式
  ///
  /// 範例：
  /// ```dart
  /// final date = DateTime(2026, 2, 7);
  /// final formatted = DateUtils.formatDate(date);  // "2026-02-07"
  /// ```
  static String formatDate(DateTime date) {
    return '${date.year}-${_padZero(date.month)}-${_padZero(date.day)}';
  }

  /// 格式化日期時間為「YYYY-MM-DD HH:mm:ss」格式
  static String formatDateTime(DateTime dateTime) {
    return '${formatDate(dateTime)} ${_padZero(dateTime.hour)}:${_padZero(dateTime.minute)}:${_padZero(dateTime.second)}';
  }

  /// 補零輔助函數（內部使用）
  static String _padZero(int value) => value.toString().padLeft(2, '0');
}
