export type AppRoute =
  | 'overview'
  | 'my-vesting'
  | 'create-batch'

export type TransactionState =
  | 'disconnected'
  | 'idle'
  | 'loading'
  | 'error'
  | 'pending'
  | 'rejected'
  | 'reverted'
  | 'success'
