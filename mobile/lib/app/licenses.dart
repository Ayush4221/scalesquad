import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

void registerAssetLicenses() {
  for (final entry in const {
    'Lucide': 'lucide-ISC.txt',
    'Chivo': 'chivo-OFL.txt',
    'Bungee': 'bungee-OFL.txt',
  }.entries) {
    LicenseRegistry.addLicense(() async* {
      final text = await rootBundle.loadString(
        'assets/licenses/${entry.value}',
      );
      yield LicenseEntryWithLineBreaks([entry.key], text);
    });
  }
}
