import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/error/api_error_message.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/utils/file_download.dart';
import '../providers/scheme_provider.dart';

/// Certificate download screen — downloads and opens the vaccination PDF certificate.
class CertificateScreen extends ConsumerStatefulWidget {
  const CertificateScreen({super.key});

  @override
  ConsumerState<CertificateScreen> createState() => _CertificateScreenState();
}

class _CertificateScreenState extends ConsumerState<CertificateScreen> {
  bool _isDownloading = false;
  double _downloadProgress = 0;
  String? _error;
  bool _downloadSuccess = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(schemeProvider.notifier).loadScheme());
  }

  Future<void> _downloadCertificate() async {
    setState(() {
      _isDownloading = true;
      _downloadProgress = 0;
      _error = null;
      _downloadSuccess = false;
    });

    try {
      final api = ref.read(apiClientProvider);

      final r = await api.dio.get<List<int>>(
        '/certificates/scheme',
        options: Options(responseType: ResponseType.bytes),
        onReceiveProgress: (received, total) {
          if (total > 0) {
            setState(() => _downloadProgress = received / total);
          }
        },
      );

      final bytes = r.data!;
      await saveAndOpenFile(bytes, 'certificado_vacunacion.pdf');

      setState(() {
        _isDownloading = false;
        _downloadSuccess = true;
      });
    } on DioException catch (e) {
      final detail = apiErrorMessageFromData(e.response?.data);
      setState(() {
        _isDownloading = false;
        _error = detail ?? 'No se pudo procesar la solicitud del certificado.';
      });
    } catch (e) {
      setState(() {
        _isDownloading = false;
        _error = 'Error inesperado: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final schemeState = ref.watch(schemeProvider);
    final eligibility = schemeState.overview?.isCertifiable ?? false;
    return Scaffold(
      appBar: AppBar(title: const Text('Certificado de Vacunación')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const SizedBox(height: 24),
            // Certificate icon
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.1),
                    AppColors.success.withValues(alpha: 0.1),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _downloadSuccess
                    ? Icons.verified
                    : Icons.workspace_premium_outlined,
                size: 56,
                color: _downloadSuccess ? AppColors.success : AppColors.primary,
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Certificado de Esquema\nde Vacunación',
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Text(
              'La disponibilidad del certificado se determina en el servidor según la evaluación vigente de tu esquema.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            if (_downloadSuccess) ...[
              const SizedBox(height: 12),
              const Text(
                'El PDF incluye un QR para consultar la vigencia y comprobar la integridad del archivo.',
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 32),

            if (schemeState.isOffline)
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Text(
                  'Información no verificada por falta de conexión.',
                  textAlign: TextAlign.center,
                ),
              )
            else if (!schemeState.isLoading)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  eligibility
                      ? 'El servidor permite emitir tu certificado.'
                      : 'El servidor todavía no permite emitir el certificado.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ),

            // Error response from the authoritative certificate endpoint.
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.error.withValues(alpha: 0.3),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          color: AppColors.error,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              color: AppColors.error,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Progress
            if (_isDownloading) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: _downloadProgress > 0 ? _downloadProgress : null,
                  minHeight: 8,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _downloadProgress > 0
                    ? '${(_downloadProgress * 100).toStringAsFixed(0)}%'
                    : 'Generando certificado...',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                ),
              ),
            ],

            // Download button
            if (!_isDownloading) ...[
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: eligibility && !schemeState.isOffline
                      ? _downloadCertificate
                      : null,
                  icon: const Icon(Icons.download_outlined),
                  label: Text(
                    _downloadSuccess
                        ? 'Descargar de nuevo'
                        : 'Descargar Certificado',
                  ),
                ),
              ),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
