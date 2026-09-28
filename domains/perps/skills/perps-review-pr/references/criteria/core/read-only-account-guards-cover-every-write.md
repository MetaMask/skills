# Read-only Account Guards Cover Every Write

Inventory exchange calls, transfers, cancellation, withdrawals and registered
venue-key paths before claiming an account is read-only. Guard the narrow shared
write boundary before local side effects; preserve setup needed for authenticated
reads. A missing public export is a contract defect even when internal tests pass.
