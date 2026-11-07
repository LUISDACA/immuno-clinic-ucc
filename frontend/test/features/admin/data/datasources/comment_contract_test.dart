import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/features/admin/data/datasources/admin_remote_ds.dart';

class MockApi extends Mock implements ApiClient {}

void main() {
  test(
    'comment datasource uses PATCH without status or review metadata',
    () async {
      final api = MockApi();
      final dio = Dio(BaseOptions(baseUrl: 'https://synthetic.invalid'));
      when(() => api.dio).thenReturn(dio);
      final requests = <RequestOptions>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(Response(requestOptions: options, statusCode: 200));
          },
        ),
      );
      await AdminRemoteDataSource(
        api,
      ).updateDoseComment('synthetic-dose', null);
      expect(requests.single.method, 'PATCH');
      expect(requests.single.path, '/admin/doses/synthetic-dose/comment');
      expect(requests.single.data, {'admin_notes': null});
    },
  );
}
