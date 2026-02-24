import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kAiConsentKey = 'ai_consent_granted';

class AiConsentNotifier extends StateNotifier<bool> {
  AiConsentNotifier() : super(false) {
    _loadFromPrefs();
  }

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getBool(_kAiConsentKey) ?? false;
  }

  Future<void> grant() async {
    state = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAiConsentKey, true);
  }

  Future<void> revoke() async {
    state = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAiConsentKey, false);
  }
}

final aiConsentProvider =
    StateNotifierProvider<AiConsentNotifier, bool>((ref) {
  return AiConsentNotifier();
});
