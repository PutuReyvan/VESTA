export type AppRoute =
  | 'login'
  | 'sign-up'
  | 'overview'
  | 'my-vesting'
  | 'create-batch'

export type Role =
  | 'company-admin'
  | 'hr-operator'
  | 'employee'
  | 'auditor'

export type TransactionState =
  | 'disconnected'
  | 'idle'
  | 'loading'
  | 'pending'
  | 'rejected'
  | 'reverted'
  | 'success'
