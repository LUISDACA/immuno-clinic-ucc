import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../firebase_options.dart';
import '../network/api_client.dart';
import '../session/session_manager.dart';
import 'package:dio/dio.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

final pushNotificationServiceProvider = Provider<PushNotificationService>((
  ref,
) {
  return PushNotificationService(
    ref.watch(apiClientProvider),
    session: ref.read(sessionManagerProvider),
  );
});

class PushNotificationService {
  static const _androidChannel = AndroidNotificationChannel(
    'immuno_clinic_updates',
    'Actualizaciones ImmunoClinic',
    description: 'Notificaciones importantes del esquema de vacunación',
    importance: Importance.high,
  );

  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  static Future<void>? _initializationFuture;

  final ApiClient _api;
  final FirebaseMessaging? _messaging;
  final SessionManager _session;
  StreamSubscription<String>? _tokenSubscription;
  int _epoch = 0;
  static bool _active = false;

  PushNotificationService(
    this._api, {
    FirebaseMessaging? messaging,
    SessionManager? session,
  }) : _messaging = messaging,
       _session = session ?? SessionManager();

  static Future<void> initialize() async {
    _initializationFuture ??= _initializeOnce();
    return _initializationFuture!;
  }

  static Future<void> _initializeOnce() async {
    if (!_isSupportedPlatform) return;
    await _ensureFirebaseInitialized();

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(settings: initSettings);

    if (defaultTargetPlatform == TargetPlatform.android) {
      await _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(_androidChannel);
    }

    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
  }

  Future<void> registerDevice() async {
    if (!_isSupportedPlatform) return;
    final epoch = ++_epoch;
    final sessionEpoch = _session.generation;
    await _tokenSubscription?.cancel();
    await initialize();

    final messaging = _firebaseMessaging;
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return;
    }

    final token = await messaging.getToken();
    if (token == null || token.isEmpty) return;

    if (epoch != _epoch || sessionEpoch != _session.generation) return;
    await _sendToken(token);
    if (epoch != _epoch || sessionEpoch != _session.generation) return;
    _active = true;
    _tokenSubscription = messaging.onTokenRefresh.listen((newToken) {
      if (epoch == _epoch && sessionEpoch == _session.generation) {
        unawaited(_sendToken(newToken).catchError((Object _) {}));
      }
    });
  }

  Future<void> unregisterDevice() async {
    if (!_isSupportedPlatform) return;
    final access = await _session.getAccessToken();
    final generation = _session.generation;
    ++_epoch;
    _active = false;
    await _tokenSubscription?.cancel();
    _tokenSubscription = null;
    try {
      final token = await _firebaseMessaging.getToken();
      if (token != null && token.isNotEmpty && access != null) {
        await _api.dio
            .delete(
              '/notifications/device-token',
              data: {'token': token},
              options: Options(
                headers: {'Authorization': 'Bearer $access'},
                extra: {
                  'skipRefresh': true,
                  'pinnedAuth': true,
                  'sessionGeneration': generation,
                },
              ),
            )
            .timeout(const Duration(seconds: 3));
      }
    } finally {
      await clearLocal();
    }
  }

  Future<void> clearLocal() async {
    ++_epoch;
    _active = false;
    await _tokenSubscription?.cancel();
    _tokenSubscription = null;
    if (!_isSupportedPlatform) return;
    try {
      await _firebaseMessaging.deleteToken();
    } catch (_) {
      /* offline */
    }
    try {
      await _localNotifications.cancelAll();
    } catch (_) {
      /* not initialized */
    }
  }

  FirebaseMessaging get _firebaseMessaging =>
      _messaging ?? FirebaseMessaging.instance;

  Future<void> _sendToken(String token) async {
    await _api.dio.post(
      '/notifications/device-token',
      data: {'token': token, 'platform': _platformName},
    );
  }

  static Future<void> _showForegroundNotification(RemoteMessage message) async {
    if (!_active) return;
    final notification = message.notification;
    final title = notification?.title ?? message.data['title']?.toString();
    final body = notification?.body ?? message.data['body']?.toString();
    if (title == null && body == null) return;

    const androidDetails = AndroidNotificationDetails(
      'immuno_clinic_updates',
      'Actualizaciones ImmunoClinic',
      channelDescription:
          'Notificaciones importantes del esquema de vacunación',
      importance: Importance.high,
      priority: Priority.high,
    );
    const iosDetails = DarwinNotificationDetails();
    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      id: message.hashCode,
      title: title ?? 'UCC ImmunoClinic',
      body: body ?? 'Tienes una nueva actualizacion.',
      notificationDetails: details,
    );
  }

  static bool get _isSupportedPlatform {
    return !kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.android ||
            defaultTargetPlatform == TargetPlatform.iOS);
  }

  static Future<void> _ensureFirebaseInitialized() async {
    if (Firebase.apps.isNotEmpty) return;
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  }

  String get _platformName {
    if (defaultTargetPlatform == TargetPlatform.android) return 'android';
    if (defaultTargetPlatform == TargetPlatform.iOS) return 'ios';
    return defaultTargetPlatform.name;
  }
}
