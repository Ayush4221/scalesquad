import 'package:flutter/foundation.dart';

import '../models/squad_role.dart';

/// Local introduction only; never assigns the role in an actual match.
class IntroductionController extends ChangeNotifier {
  SquadRole _selectedRole = SquadRole.traffic;
  SquadRole get selectedRole => _selectedRole;
  void selectRole(SquadRole role) {
    if (_selectedRole == role) return;
    _selectedRole = role;
    notifyListeners();
  }
}
