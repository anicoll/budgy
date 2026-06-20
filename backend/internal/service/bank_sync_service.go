package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"
)

type bankSyncService struct {
	users        domain.UserRepository
	budgets      domain.BudgetRepository
	accounts     domain.AccountRepository
	transactions domain.TransactionRepository
	provider     domain.BankSyncProvider
}

func NewBankSyncService(
	users domain.UserRepository,
	budgets domain.BudgetRepository,
	accounts domain.AccountRepository,
	transactions domain.TransactionRepository,
	provider domain.BankSyncProvider,
) BankSyncService {
	return &bankSyncService{
		users:        users,
		budgets:      budgets,
		accounts:     accounts,
		transactions: transactions,
		provider:     provider,
	}
}

func (s *bankSyncService) GetAuthLink(ctx context.Context, userID string) (string, string, error) {
	if s.provider == nil {
		return "", "", fmt.Errorf("bank sync service is not configured")
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return "", "", fmt.Errorf("%w: user not found", ErrNotFound)
	}

	basiqUserID := user.BasiqUserID
	if basiqUserID == "" {
		id, err := s.provider.CreateBasiqUser(ctx, user.Email, user.FirstName, user.LastName)
		if err != nil {
			return "", "", fmt.Errorf("failed to create Basiq user: %w", err)
		}
		basiqUserID = id
		if err := s.users.UpdateBasiqUserID(ctx, user.ID, basiqUserID); err != nil {
			return "", "", fmt.Errorf("failed to save Basiq User ID: %w", err)
		}
	}

	token, err := s.provider.GetClientToken(ctx, basiqUserID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate client token: %w", err)
	}

	connectURL := fmt.Sprintf("https://consent.basiq.io/home?token=%s", token)
	return token, connectURL, nil
}

func (s *bankSyncService) SyncUser(ctx context.Context, userID string) error {
	if s.provider == nil {
		return fmt.Errorf("bank sync service is not configured")
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("%w: user not found", ErrNotFound)
	}

	basiqUserID := user.BasiqUserID
	if basiqUserID == "" {
		return fmt.Errorf("%w: no connected Basiq account found", ErrBadRequest)
	}

	accounts, transactions, err := s.provider.FetchAccountsAndTransactions(ctx, basiqUserID)
	if err != nil {
		return fmt.Errorf("failed to fetch bank data: %w", err)
	}

	for _, acc := range accounts {
		existing, err := s.accounts.GetByID(ctx, acc.ID)
		if err != nil {
			if err := s.accounts.Create(ctx, acc); err != nil {
				return fmt.Errorf("failed to create account %s: %w", acc.ID, err)
			}
		} else {
			existing.Name = acc.Name
			existing.Balance = acc.Balance
			existing.AvailableFunds = acc.AvailableFunds
			existing.Class = acc.Class
			existing.AccountNo = acc.AccountNo
			existing.Product = acc.Product
			existing.InstitutionID = acc.InstitutionID
			existing.ConnectionID = acc.ConnectionID
			existing.LastUpdated = acc.LastUpdated
			existing.UpdatedAt = time.Now()
			if err := s.accounts.Update(ctx, existing); err != nil {
				return fmt.Errorf("failed to update account %s: %w", acc.ID, err)
			}
		}
	}

	for _, tx := range transactions {
		_, err := s.transactions.GetByID(ctx, tx.ID)
		if err != nil {
			if err := s.transactions.Create(ctx, tx); err != nil {
				return fmt.Errorf("failed to create transaction %s: %w", tx.ID, err)
			}
		} else {
			tx.UpdatedAt = time.Now()
			if err := s.transactions.Update(ctx, tx); err != nil {
				return fmt.Errorf("failed to update transaction %s: %w", tx.ID, err)
			}
		}
	}

	return nil
}
