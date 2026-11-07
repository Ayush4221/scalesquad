import 'package:flutter/material.dart';

import 'app/app.dart';
import 'app/licenses.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  registerAssetLicenses();
  runApp(const ScaleSquadApp());
}
