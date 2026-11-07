import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/communication_remote_ds.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../communication_error.dart';

class CommunicationState {
  final bool isLoading;
  final String? error;
  final List<dynamic> threads;

  const CommunicationState({
    this.isLoading = false,
    this.error,
    this.threads = const [],
  });

  CommunicationState copyWith({
    bool? isLoading,
    String? error,
    List<dynamic>? threads,
  }) {
    return CommunicationState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      threads: threads ?? this.threads,
    );
  }
}

class CommunicationNotifier extends StateNotifier<CommunicationState> {
  static const _cacheTtl = Duration(seconds: 3);

  final CommunicationRemoteDataSource _ds;
  CommunicationNotifier(this._ds) : super(const CommunicationState());

  DateTime? _lastLoadedAt;
  Future<void>? _inFlightLoad;
  bool _hasLoaded = false;
  bool _creating = false;
  int _request = 0;

  Future<void> load({bool showLoading = true, bool forceRefresh = false}) {
    if (!mounted) return Future.value();
    final lastLoadedAt = _lastLoadedAt;
    if (!forceRefresh &&
        state.error == null &&
        _hasLoaded &&
        lastLoadedAt != null &&
        DateTime.now().difference(lastLoadedAt) < _cacheTtl) {
      return Future.value();
    }

    final inFlight = _inFlightLoad;
    if (!forceRefresh && inFlight != null) return inFlight;

    final load = _load(showLoading: showLoading);
    _inFlightLoad = load;
    load.whenComplete(() {
      if (identical(_inFlightLoad, load)) _inFlightLoad = null;
    });
    return load;
  }

  Future<void> _load({required bool showLoading}) async {
    final request = ++_request;
    if (showLoading) {
      state = state.copyWith(isLoading: true, error: null);
    }
    try {
      final threads = await _ds.getThreads();
      if (!mounted || request != _request) return;
      _lastLoadedAt = DateTime.now();
      _hasLoaded = true;
      state = CommunicationState(threads: threads);
    } catch (error) {
      if (!mounted || request != _request) return;
      _lastLoadedAt = null;
      _hasLoaded = false;
      state = state.copyWith(
        isLoading: false,
        error: communicationQueryErrorMessage(error),
      );
    }
  }

  Future<Map<String, dynamic>?> createThread({
    required String subject,
    required String message,
    String? category,
    String? studentId,
    String? adminId,
  }) async {
    if (!mounted || _creating) return null;
    _creating = true;
    ++_request;
    try {
      final thread = await _ds.createThread(
        subject: subject,
        message: message,
        category: category,
        studentId: studentId,
        adminId: adminId,
      );
      if (!mounted) return null;
      await load(forceRefresh: true);
      return thread;
    } catch (_) {
      if (mounted) {
        state = state.copyWith(error: 'No se pudo crear la conversación');
      }
      return null;
    } finally {
      _creating = false;
    }
  }
}

final communicationProvider =
    StateNotifierProvider<CommunicationNotifier, CommunicationState>((ref) {
      ref.watch(authStateProvider.select((state) => state.userId));
      return CommunicationNotifier(
        ref.read(communicationRemoteDataSourceProvider),
      );
    });
