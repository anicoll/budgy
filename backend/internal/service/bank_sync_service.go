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
	budgetAccts  domain.BudgetAccountRepository
	transactions domain.TransactionRepository
	categories   domain.CategoryRepository
	reconciler   domain.BudgetReconciler
	provider     domain.BankSyncProvider
}

func NewBankSyncService(
	users domain.UserRepository,
	budgets domain.BudgetRepository,
	accounts domain.AccountRepository,
	budgetAccts domain.BudgetAccountRepository,
	transactions domain.TransactionRepository,
	categories domain.CategoryRepository,
	reconciler domain.BudgetReconciler,
	provider domain.BankSyncProvider,
) BankSyncService {
	return &bankSyncService{
		users:        users,
		budgets:      budgets,
		accounts:     accounts,
		budgetAccts:  budgetAccts,
		transactions: transactions,
		categories:   categories,
		reconciler:   reconciler,
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
	if user.BasiqUserID == "" {
		return fmt.Errorf("%w: no connected Basiq account found", ErrBadRequest)
	}

	if err := s.ensureDefaultBudget(ctx, userID); err != nil {
		return err
	}

	accounts, transactions, err := s.provider.FetchAccountsAndTransactions(ctx, user.BasiqUserID)
	if err != nil {
		return fmt.Errorf("failed to fetch bank data: %w", err)
	}

	for _, acc := range accounts {
		acc.UserID = userID
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
		categoryID := tx.CategoryID
		if categoryID == "" {
			code := tx.SubClass
			if code == "" {
				code = tx.Class
			}
			if code != "" {
				if cat, err := s.categories.GetByBasiqSubClassCode(ctx, userID, code); err == nil {
					categoryID = cat.ID
				}
			}
		}

		existing, err := s.transactions.GetByID(ctx, tx.ID)
		if err != nil {
			tx.CategoryID = categoryID
			if err := s.transactions.Create(ctx, tx); err != nil {
				return fmt.Errorf("failed to create transaction %s: %w", tx.ID, err)
			}
			continue
		}

		existing.Amount = tx.Amount
		existing.Description = tx.Description
		existing.Date = tx.Date
		existing.Direction = tx.Direction
		existing.Status = tx.Status
		existing.Class = tx.Class
		existing.PostDate = tx.PostDate
		existing.SubClass = tx.SubClass
		existing.RawDescription = tx.RawDescription
		existing.MerchantName = tx.MerchantName
		existing.MerchantWebsite = tx.MerchantWebsite
		existing.MerchantLogoURL = tx.MerchantLogoURL
		existing.LocationAddress = tx.LocationAddress
		existing.LocationLat = tx.LocationLat
		existing.LocationLng = tx.LocationLng
		existing.CategoryCode = tx.CategoryCode
		existing.CategoryTitle = tx.CategoryTitle
		existing.UpdatedAt = time.Now()
		if categoryID != "" {
			existing.CategoryID = categoryID
		}
		if err := s.transactions.Update(ctx, existing); err != nil {
			return fmt.Errorf("failed to update transaction %s: %w", tx.ID, err)
		}
	}

	if s.reconciler != nil {
		if bs, ok := s.reconciler.(interface {
			ReconcileAllForUser(ctx context.Context, userID string) error
		}); ok {
			return bs.ReconcileAllForUser(ctx, userID)
		}
	}
	return nil
}

func (s *bankSyncService) ensureDefaultBudget(ctx context.Context, userID string) error {
	budgetsList, err := s.budgets.List(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to list budgets: %w", err)
	}
	if len(budgetsList) > 0 {
		return nil
	}
	defaultBudget := &domain.Budget{
		ID:        generateID(),
		UserID:    userID,
		Name:      "Default Budget",
		Method:    domain.MethodZeroSum,
		Currency:  "AUD",
		Period:    domain.PeriodMonthly,
		StartDate: time.Now().Format("2006-01-02"),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.budgets.Create(ctx, defaultBudget); err != nil {
		return fmt.Errorf("failed to create default budget: %w", err)
	}
	return nil
}
