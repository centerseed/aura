/// API 端點常量
class ApiEndpoints {
  ApiEndpoints._();

  // ==================== Auth ====================
  static const String signIn = '/api/auth/signin';
  static const String me = '/api/me';
  static const String aiUsage = '/api/me/ai-usage';

  // ==================== Brain Dump ====================
  static const String brainDump = '/api/brain-dump';

  // ==================== Tasks ====================
  static const String tasks = '/api/tasks';
  static String task(String id) => '/api/tasks/$id';
  static String taskReferences(String id) => '/api/tasks/$id/references';
  static String taskSubItems(String id) => '/api/tasks/$id/sub-items';

  // ==================== Library ====================
  static const String library = '/api/library';

  // ==================== Areas ====================
  static const String areas = '/api/areas';
  static String area(String id) => '/api/areas/$id';

  // ==================== Products ====================
  static const String products = '/api/products';
  static String product(String id) => '/api/products/$id';
  static String productReorganize(String id) =>
      '/api/products/$id/reorganize-topics';

  // ==================== Milestones ====================
  static const String milestones = '/api/milestones';
  static String milestone(String id) => '/api/milestones/$id';
}
