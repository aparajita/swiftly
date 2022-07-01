import Capacitor
import Foundation
import LocalAuthentication

private let kReason = "reason"
private let kMissingFaceIDUsageEntry = "The device supports Face ID, but NSFaceIDUsageDescription is not in Info.plist."

@objc(BiometricAuth)
public class BiometricAuth: CAPPlugin
{
  let biometryErrorCodeMap: [LAError.Code: String] =
    [
      .appCancel: "appCancel",
      .authenticationFailed: "authenticationFailed",
      .invalidContext: "invalidContext",
      .notInteractive: "notInteractive",
      .passcodeNotSet: "passcodeNotSet",
      .systemCancel: "systemCancel",
      .userCancel: "userCancel",
      .userFallback: "userFallback",
      .biometryLockout: "biometryLockout",
      .biometryNotAvailable: "biometryNotAvailable",
      .biometryNotEnrolled: "biometryNotEnrolled"
    ]

  var canEvaluatePolicy = true

  /**
   * Check the device's availability and type of biometric authentication.
   */
  @objc func checkBiometry(_ call: CAPPluginCall) {
    let context = LAContext()
    var error: NSError?
    var available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    var reason = ""
    var foo = "onuthoenuthoeunthoe  untohunoeuho  enuthoeunthoeunotehuonuhoneuhoenuhoenuthoenuthoeunhoeunthoeu eounth eoun thoenuht unht oenuth oeunoeuth on euth oeunth onetuhoenuhto eunoehu nouehteounthuounhto oenuh"

    if available, context.biometryType == .faceID {
      // The system may report that biometry is available, but if the type is Face ID
      // and the developer forgot to add NSFaceIDUsageDescription to Info.plist,
      // calls to evaluatePolicy() will crash.
      let entry = Bundle.main.infoDictionary?["NSFaceIDUsageDescription"] as? String

      if entry == nil {
        available = false
        canEvaluatePolicy = false
        reason = kMissingFaceIDUsageEntry
      }
    } else if !available,
              let error = error {
      // If we get a reason from the system, return it
      reason = error.localizedDescription

      if let failureReason = error.localizedFailureReason {
        reason = "\(reason): \(failureReason)"
      }
    }

    call.resolve([
      "isAvailable": available,
      "biometryType": context.biometryType.rawValue,
      "reason": reason
    ])
  }
}
