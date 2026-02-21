import 'dart:async';
import 'package:flutter/material.dart';
import 'package:app/core/theme/app_colors.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/di/providers.dart';
import 'package:app/domain/entities/task.dart';
import 'package:app/presentation/providers/task_provider.dart';

enum FocusPhase { focus, shortBreak, longBreak }

class FocusScreen extends ConsumerStatefulWidget {
  final Task task;

  const FocusScreen({super.key, required this.task});

  @override
  ConsumerState<FocusScreen> createState() => _FocusScreenState();
}

class _FocusScreenState extends ConsumerState<FocusScreen> {
  // Pomodoro Constants
  // Pomodoro Settings (Mutable)
  int _focusMinutes = 25;
  int _shortBreakMinutes = 5;
  int _longBreakMinutes = 15;
  static const int _roundsBeforeLongBreak = 4;

  bool _isSetupMode = true;

  late int _remainingSeconds;
  Timer? _timer;
  bool _isActive = false;

  FocusPhase _currentPhase = FocusPhase.focus;
  int _completedRounds = 0;

  late Task _task;

  @override
  void initState() {
    super.initState();
    _task = widget.task;
    // Initialize default time but wait for user to start in setup mode
    _remainingSeconds = _focusMinutes * 60;
  }

  void _resetTimerForPhase(FocusPhase phase) {
    setState(() {
      switch (phase) {
        case FocusPhase.focus:
          _remainingSeconds = _focusMinutes * 60;
          break;
        case FocusPhase.shortBreak:
          _remainingSeconds = _shortBreakMinutes * 60;
          break;
        case FocusPhase.longBreak:
          _remainingSeconds = _longBreakMinutes * 60;
          break;
      }
    });
  }

  void _startTimer() {
    setState(() {
      _isActive = true;
    });
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        setState(() {
          _remainingSeconds--;
        });
      } else {
        _timer?.cancel();
        _handleTimerComplete();
      }
    });
  }

  void _handleTimerComplete() {
    HapticFeedback.heavyImpact();
    setState(() {
      _isActive = false;
    });

    // Determine next phase logic
    FocusPhase nextPhase;
    if (_currentPhase == FocusPhase.focus) {
      _completedRounds++;
      if (_completedRounds % _roundsBeforeLongBreak == 0) {
        nextPhase = FocusPhase.longBreak;
      } else {
        nextPhase = FocusPhase.shortBreak;
      }
    } else {
      // After any break, return to focus
      nextPhase = FocusPhase.focus;
    }

    // Show dialog or auto transition? Let's show a dialog/bottom sheet to prompt
    // but for now, we'll just switch phases and stop, waiting for user to start.
    setState(() {
      _currentPhase = nextPhase;
    });
    _resetTimerForPhase(nextPhase);

    // Auto-start breaks? Or manual?
    // Zentropy philosophy: Flow should be seamless, but breaks are intentional.
    // Let's pause and let user tap to start break.
    // We can show a snackbar.
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_getPhaseCompletionMessage()),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  String _getPhaseCompletionMessage() {
    if (_currentPhase == FocusPhase.focus) {
      return "Time to focus!";
    } else if (_currentPhase == FocusPhase.shortBreak) {
      return "Take a short break.";
    } else {
      return "Time for a long break.";
    }
  }

  void _toggleTimer() {
    if (_isActive) {
      _timer?.cancel();
      setState(() {
        _isActive = false;
      });
    } else {
      _startTimer();
    }
  }

  void _skipPhase() {
    _timer?.cancel();
    HapticFeedback.mediumImpact();
    _handleTimerComplete();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String get _timerString {
    final minutes = (_remainingSeconds / 60).floor().toString().padLeft(2, '0');
    final seconds = (_remainingSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  String get _phaseLabel {
    switch (_currentPhase) {
      case FocusPhase.focus:
        return 'FOCUS';
      case FocusPhase.shortBreak:
        return 'SHORT BREAK';
      case FocusPhase.longBreak:
        return 'LONG BREAK';
    }
  }

  Color get _phaseColor {
    switch (_currentPhase) {
      case FocusPhase.focus:
        return AppColors.pomodoroFocus; // Red/Orange for Focus
      case FocusPhase.shortBreak:
        return AppColors.pomodoroShortBreak; // Teal for Short break
      case FocusPhase.longBreak:
        return AppColors.pomodoroLongBreak; // Deep teal/blue for Long break
    }
  }

  Future<void> _completeTask() async {
    _timer?.cancel();
    HapticFeedback.mediumImpact();

    try {
      final repository = ref.read(taskRepositoryProvider);
      final updatedTask = widget.task.copyWith(status: TaskStatus.archive);
      final result = await repository.updateTask(updatedTask);

      result.fold(
        (failure) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: ${failure.message}')),
            );
          }
        },
        (_) async {
          // 觸發靜默刷新
          await silentRefreshTasks(ref);

          if (mounted) {
            Navigator.of(context).pop(); // Return to dashboard
            if (mounted) {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(const SnackBar(content: Text('太棒了！任務完成！')));
            }
          }
        },
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Dark immersive theme for Focus Mode
    final phaseColor = _phaseColor;
    final isBreak = _currentPhase != FocusPhase.focus;

    if (_isSetupMode) {
      return _buildSetupScreen(context);
    }

    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      body: SafeArea(
        child: Column(
          children: [
            // Top Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white70),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: phaseColor.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: phaseColor.withOpacity(0.5)),
                    ),
                    child: Text(
                      _phaseLabel,
                      style: TextStyle(
                        color: phaseColor,
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.skip_next, color: Colors.white30),
                    onPressed: _skipPhase,
                    tooltip: "Skip Phase",
                  ),
                ],
              ),
            ),

            const Spacer(),

            // Timer Display
            GestureDetector(
              onTap: _toggleTimer,
              child: Text(
                _timerString,
                style: const TextStyle(
                  fontFamily: 'Monospace',
                  fontSize: 80,
                  fontWeight: FontWeight.w200,
                  color: Colors.white,
                  letterSpacing: -2,
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Animated Pulse or Status
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _isActive
                    ? phaseColor.withOpacity(0.2)
                    : Colors.grey.withOpacity(0.2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _isActive
                      ? phaseColor.withOpacity(0.5)
                      : Colors.grey.withOpacity(0.3),
                ),
              ),
              child: Text(
                _isActive ? 'RUNNING' : 'PAUSED',
                style: TextStyle(
                  color: _isActive ? phaseColor : Colors.grey,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  letterSpacing: 1.0,
                ),
              ),
            ),

            // Pomodoro progress dots (only if in focus mode or recent)
            if (!isBreak) ...[
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(4, (index) {
                  final isCompleted =
                      index < (_completedRounds % _roundsBeforeLongBreak);
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isCompleted ? phaseColor : Colors.white10,
                    ),
                  );
                }),
              ),
            ],

            const SizedBox(height: 48),

            // Task Entity Card (Current Task) - Only show relevant task info during focus
            // During Break, maybe show "Relax" message
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 32),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white10),
              ),
              child: isBreak
                  ? Column(
                      children: [
                        Icon(Icons.coffee, color: phaseColor, size: 40),
                        const SizedBox(height: 16),
                        Text(
                          _currentPhase == FocusPhase.shortBreak
                              ? "Take a breath"
                              : "Go for a walk",
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    )
                  : Column(
                      children: [
                        Text(
                          widget.task.content,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                            height: 1.3,
                          ),
                        ),
                        if (widget.task.areaName != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            widget.task.areaName!,
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.5),
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ],
                    ),
            ),

            const Spacer(),

            // Action Buttons
            Padding(
              padding: const EdgeInsets.all(32.0),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        // Add 5 minutes
                        setState(() {
                          _remainingSeconds += 300;
                        });
                      },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        side: const BorderSide(color: Colors.white24),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        '+5 Min',
                        style: TextStyle(color: Colors.white70),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _completeTask,
                      icon: const Icon(Icons.check),
                      label: const Text('COMPLETE'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(
                          0xFF4ADE80,
                        ), // Keep Green for Success
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSetupScreen(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepBlack, // Deep Black
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white70, size: 28),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 10),
                    // Task Details Card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppColors.darkBackground,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.08),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (widget.task.areaName != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              margin: const EdgeInsets.only(bottom: 12),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.08),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                widget.task.areaName!,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          Text(
                            widget.task.content,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              height: 1.3,
                            ),
                          ),
                          if (_task.subItems != null &&
                              _task.subItems!.isNotEmpty) ...[
                            const SizedBox(height: 20),
                            const Divider(color: Colors.white10),
                            const SizedBox(height: 12),
                            ..._task.subItems!.map(
                              (item) => InkWell(
                                onTap: () {
                                  // Optimistic update
                                  final newCompleted = !item.completed;
                                  final updatedSubItems = _task.subItems!.map((
                                    s,
                                  ) {
                                    if (s.id == item.id) {
                                      return s.copyWith(
                                        completed: newCompleted,
                                      );
                                    }
                                    return s;
                                  }).toList();

                                  setState(() {
                                    _task = _task.copyWith(
                                      subItems: updatedSubItems,
                                    );
                                  });

                                  // API call
                                  ref
                                      .read(taskControllerProvider.notifier)
                                      .updateSubItemStatus(
                                        _task,
                                        item.id,
                                        newCompleted,
                                      );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 8.0),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Padding(
                                        padding: const EdgeInsets.only(
                                          top: 2,
                                          right: 10,
                                        ),
                                        child: Icon(
                                          item.completed
                                              ? Icons.check_circle
                                              : Icons.circle_outlined,
                                          size: 16,
                                          color: item.completed
                                              ? Colors.greenAccent
                                              : Colors.white.withOpacity(0.3),
                                        ),
                                      ),
                                      Expanded(
                                        child: Text(
                                          item.content,
                                          style: TextStyle(
                                            color: item.completed
                                                ? Colors.white.withOpacity(0.3)
                                                : Colors.white.withOpacity(0.7),
                                            fontSize: 14,
                                            height: 1.4,
                                            decoration: item.completed
                                                ? TextDecoration.lineThrough
                                                : null,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    const SizedBox(height: 48),

                    // Time Settings
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: _buildLargeTimePicker(
                            label: '專注時間',
                            value: _focusMinutes,
                            color: AppColors.pomodoroFocus,
                            onChanged: (val) =>
                                setState(() => _focusMinutes = val),
                          ),
                        ),
                        Container(width: 1, height: 60, color: Colors.white10),
                        Expanded(
                          child: _buildLargeTimePicker(
                            label: '休息時間',
                            value: _shortBreakMinutes,
                            color: AppColors.pomodoroShortBreak,
                            onChanged: (val) =>
                                setState(() => _shortBreakMinutes = val),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Start Button
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _startSession,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 22),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    '開始專注',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLargeTimePicker({
    required String label,
    required int value,
    required Color color,
    required ValueChanged<int> onChanged,
  }) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withOpacity(0.4),
            fontSize: 12,
            letterSpacing: 1.5,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            InkWell(
              onTap: () {
                if (value > 1) {
                  HapticFeedback.selectionClick();
                  onChanged(value - 1);
                }
              },
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Icon(Icons.remove, color: Colors.white.withOpacity(0.2)),
              ),
            ),
            SizedBox(
              width: 80,
              child: Text(
                "$value",
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: color,
                  fontSize: 48,
                  fontWeight: FontWeight.w300,
                  fontFamily: 'Monospace', // Or user preferred font
                ),
              ),
            ),
            InkWell(
              onTap: () {
                if (value < 60) {
                  HapticFeedback.selectionClick();
                  onChanged(value + 1);
                }
              },
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Icon(Icons.add, color: Colors.white.withOpacity(0.2)),
              ),
            ),
          ],
        ),
        Text(
          "分鐘",
          style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 12),
        ),
      ],
    );
  }

  void _startSession() {
    setState(() {
      _isSetupMode = false;
      // Initialize with correct focus time
      _resetTimerForPhase(FocusPhase.focus);
    });
    _startTimer();
  }
}
