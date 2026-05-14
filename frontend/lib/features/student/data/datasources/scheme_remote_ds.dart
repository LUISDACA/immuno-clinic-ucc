import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';

/// Data source for vaccination scheme API calls.
class SchemeRemoteDataSource {
  final ApiClient _api;
  SchemeRemoteDataSource(this._api);

  Future<Map<String, dynamic>> getMyScheme() async {
    final r = await _api.dio.get('/scheme/');
    return r.data;
  }

  Future<void> updateDose(
    String doseId, {
    String? appliedDate,
    bool clearAppliedDate = false,
    String? titerValue,
    bool clearTiterValue = false,
  }) async {
    final data = <String, dynamic>{};
    if (clearAppliedDate) {
      data['applied_date'] = null;
    } else if (appliedDate != null) {
      data['applied_date'] = appliedDate;
    }
    if (clearTiterValue) {
      data['titer_value'] = null;
    } else if (titerValue != null) {
      data['titer_value'] = titerValue;
    }
    await _api.dio.put('/scheme/doses/$doseId', data: data);
  }
}

final schemeRemoteDataSourceProvider = Provider<SchemeRemoteDataSource>((ref) {
  return SchemeRemoteDataSource(ref.read(apiClientProvider));
});
