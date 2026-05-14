// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;
import 'dart:convert';

Future<void> saveAndOpenFile(List<int> bytes, String fileName) async {
  final base64Data = base64Encode(bytes);
  final uri = 'data:application/octet-stream;base64,$base64Data';
  html.AnchorElement(href: uri)
    ..setAttribute('download', fileName)
    ..click();
}
