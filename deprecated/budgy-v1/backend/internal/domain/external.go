package domain

import (
	"context"
)

// BankSyncProvider defines the outbound port for interacting with Basiq bank sync services.
type BankSyncProvider interface {
	CreateBasiqUser(ctx context.Context, email, firstName, lastName string) (string, error)
	GetClientToken(ctx context.Context, basiqUserID string) (string, error)
	FetchAccountsAndTransactions(ctx context.Context, basiqUserID string) ([]*Account, []*Transaction, error)
	RegisterWebhook(ctx context.Context, webhookURL string) error
}
