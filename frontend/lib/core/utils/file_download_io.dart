import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';

Future<void> saveAndOpenFile(List<int> bytes, String fileName) async {
  final dir = await getApplicationDocumentsDirectory();
  final file = File('${dir.path}/$fileName');
  await file.writeAsBytes(bytes);
  await OpenFilex.open(file.path);
}
