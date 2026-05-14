import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/communication_remote_ds.dart';

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

  Future<void> load({bool showLoading = true, bool forceRefresh = false}) {
    final lastLoadedAt = _lastLoadedAt;
    if (!forceRefresh &&
        _hasLoaded &&
        lastLoadedAt != null &&
        DateTime.now().difference(lastLoadedAt) < _cacheTtl) {
      return Future.value();
    }

    final inFlight = _inFlightLoad;
    if (inFlight != null) return inFlight;

    final load = _load(showLoading: showLoading);
    _inFlightLoad = load;
    load.whenComplete(() => _inFlightLoad = null);
    return load;
  }

  Future<void> _load({required bool showLoading}) async {
    if (showLoading) {
      state = state.copyWith(isLoading: true, error: null);
    }
    try {
      final threads = await _ds.getThreads();
      _lastLoadedAt = DateTime.now();
      _hasLoaded = true;
      state = CommunicationState(threads: threads);
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        error: 'No se pudieron cargar las conversaciones',
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
    try {
      final thread = await _ds.createThread(
        subject: subject,
        message: message,
        category: category,
        studentId: studentId,
        adminId: adminId,
      );
      await load(forceRefresh: true);
      return thread;
    } catch (_) {
      state = state.copyWith(error: 'No se pudo crear la conversación');
      return null;
    }
  }
}

final communicationProvider =
    StateNotifierProvider<CommunicationNotifier, CommunicationState>((ref) {
      return CommunicationNotifier(
        ref.read(communicationRemoteDataSourceProvider),
      );
    });
