import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kAiConsentKey = 'ai_consent_granted';
const _kAiConsentDismissedKey = 'ai_consent_dismissed';

typedef AiConsentState = ({bool granted, bool dismissed});

class AiConsentNotifier extends StateNotifier<AiConsentState> {
  AiConsentNotifier() : super((granted: false, dismissed: false)) {
    _loadFromPrefs();
  }

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    state = (
      granted: prefs.getBool(_kAiConsentKey) ?? false,
      dismissed: prefs.getBool(_kAiConsentDismissedKey) ?? false,
    );
  }

  Future<void> grant() async {
    state = (granted: true, dismissed: state.dismissed);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAiConsentKey, true);
  }

  Future<void> dismiss() async {
    state = (granted: state.granted, dismissed: true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAiConsentDismissedKey, true);
  }

  Future<void> revoke() async {
    state = (granted: false, dismissed: false);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAiConsentKey, false);
    await prefs.setBool(_kAiConsentDismissedKey, false);
  }
}

final aiConsentProvider =
    StateNotifierProvider<AiConsentNotifier, AiConsentState>((ref) {
  return AiConsentNotifier();
});
