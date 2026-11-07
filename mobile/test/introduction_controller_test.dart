import 'package:flutter_test/flutter_test.dart';
import 'package:scalesquad_mobile/features/introduction/controllers/introduction_controller.dart';
import 'package:scalesquad_mobile/features/introduction/models/squad_role.dart';

void main() {
  test('role exploration changes local presentation only and does not notify twice', () {
    final controller = IntroductionController();
    addTearDown(controller.dispose);
    var notifications = 0;
    controller.addListener(() => notifications++);
    expect(controller.selectedRole, SquadRole.traffic);
    controller.selectRole(SquadRole.data);
    controller.selectRole(SquadRole.data);
    expect(controller.selectedRole, SquadRole.data);
    expect(notifications, 1);
    controller.selectRole(SquadRole.operations);
    expect(notifications, 2);
  });
}
