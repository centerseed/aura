import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/ai_consent_provider.dart';
import '../widgets/ai_consent_dialog.dart';

/// Returns true if AI features may proceed (consent already granted, or user
/// permanently dismissed the dialog). Shows the consent dialog if needed and
/// persists the user's choice.
Future<bool> checkAndRequestAiConsent(BuildContext context, WidgetRef ref) async {
  final consent = ref.read(aiConsentProvider);
  if (consent.granted || consent.dismissed) return true;

  final result = await AiConsentDialog.show(context);
  if (result.dismissed) ref.read(aiConsentProvider.notifier).dismiss();
  if (result.granted) ref.read(aiConsentProvider.notifier).grant();
  return result.granted || result.dismissed;
}
