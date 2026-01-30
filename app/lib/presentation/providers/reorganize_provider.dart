import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/reorganize_proposal.dart';
import 'product_provider.dart';

// State to hold the current proposal for a given product
final reorganizeProposalProvider =
    StateProvider.autoDispose<ReorganizeProposal?>((ref) => null);

// Controller to handle actions
class ReorganizeController extends StateNotifier<AsyncValue<void>> {
  final Ref ref;

  ReorganizeController(this.ref) : super(const AsyncValue.data(null));

  Future<void> analyze(String productId) async {
    state = const AsyncValue.loading();
    final repository = ref.read(productRepositoryProvider);
    final result = await repository.reorganizeTopics(productId);

    result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
      },
      (proposal) {
        ref.read(reorganizeProposalProvider.notifier).state = proposal;
        state = const AsyncValue.data(null);
      },
    );
  }

  Future<void> apply(String productId) async {
    final proposal = ref.read(reorganizeProposalProvider);
    if (proposal == null) return;

    state = const AsyncValue.loading();
    final repository = ref.read(productRepositoryProvider);
    final result = await repository.applyReorganization(productId, proposal);

    result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
      },
      (_) {
        // Success - clear proposal
        ref.read(reorganizeProposalProvider.notifier).state = null;
        state = const AsyncValue.data(null);
        // We might want to trigger a refresh of tasks here
        // ref.refresh(activeTasksProvider); // Assuming activeTasksProvider exists and needs refresh
      },
    );
  }
}

final reorganizeControllerProvider =
    StateNotifierProvider.autoDispose<ReorganizeController, AsyncValue<void>>((
      ref,
    ) {
      return ReorganizeController(ref);
    });
