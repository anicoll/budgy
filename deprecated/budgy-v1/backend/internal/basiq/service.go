package basiq

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"budgeting_system/internal/domain"
)

// Service encapsulates interactions with Basiq APIs.
type Service struct {
	apiKey     string
	httpClient *http.Client
}

// NewService creates a new Service instance.
func NewService(apiKey string) *Service {
	return &Service{
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// GetServerToken fetches a SERVER_ACCESS token from Basiq.
func (s *Service) GetServerToken(ctx context.Context) (string, error) {
	apiURL := "https://au-api.basiq.io/token"
	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader("scope=SERVER_ACCESS"))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Basic "+s.apiKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("basiq-version", "3.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("basiq token error (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}
	return tokenResp.AccessToken, nil
}

// GetClientToken fetches a CLIENT_ACCESS token from Basiq scoped for a specific user.
func (s *Service) GetClientToken(ctx context.Context, basiqUserID string) (string, error) {
	apiURL := "https://au-api.basiq.io/token"
	data := url.Values{}
	data.Set("scope", "CLIENT_ACCESS")
	data.Set("userId", basiqUserID)

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Basic "+s.apiKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("basiq-version", "3.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("basiq client token error (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}
	return tokenResp.AccessToken, nil
}

// CreateBasiqUser provisions a new Basiq user resource.
func (s *Service) CreateBasiqUser(ctx context.Context, email, firstName, lastName string) (string, error) {
	token, err := s.GetServerToken(ctx)
	if err != nil {
		return "", err
	}

	client, err := NewClient("https://au-api.basiq.io", WithRequestEditorFn(func(ctx context.Context, req *http.Request) error {
		req.Header.Set("Authorization", "Bearer "+token)
		return nil
	}))
	if err != nil {
		return "", err
	}

	body := CreateUserJSONRequestBody{
		Email:     &email,
		FirstName: &firstName,
		LastName:  &lastName,
	}

	resp, err := client.CreateUser(ctx, body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to create basiq user (status %d): %s", resp.StatusCode, string(respBody))
	}

	var userResp struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		return "", err
	}

	return userResp.ID, nil
}

// RegisterWebhook verifies and creates the Basiq webhook subscription.
func (s *Service) RegisterWebhook(ctx context.Context, webhookURL string) error {
	token, err := s.GetServerToken(ctx)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://au-api.basiq.io/notifications/webhooks", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("basiq-version", "3.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to list webhooks (status %d): %s", resp.StatusCode, string(body))
	}

	var webhooksResp struct {
		Data []struct {
			ID  string `json:"id"`
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&webhooksResp); err != nil {
		return err
	}

	for _, wh := range webhooksResp.Data {
		if wh.URL == webhookURL {
			return nil
		}
	}

	webhookData := map[string]any{
		"url": webhookURL,
		"subscribedEvents": []string{
			"connection.created",
			"connection.deleted",
			"connection.invalidated",
			"transaction.created",
			"transaction.updated",
		},
	}
	jsonData, err := json.Marshal(webhookData)
	if err != nil {
		return err
	}

	reqPost, err := http.NewRequestWithContext(ctx, "POST", "https://au-api.basiq.io/notifications/webhooks", strings.NewReader(string(jsonData)))
	if err != nil {
		return err
	}
	reqPost.Header.Set("Authorization", "Bearer "+token)
	reqPost.Header.Set("Content-Type", "application/json")
	reqPost.Header.Set("basiq-version", "3.0")

	respPost, err := s.httpClient.Do(reqPost)
	if err != nil {
		return err
	}
	defer respPost.Body.Close()

	if respPost.StatusCode != http.StatusCreated && respPost.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(respPost.Body)
		return fmt.Errorf("failed to create webhook (status %d): %s", respPost.StatusCode, string(body))
	}

	return nil
}

// FetchAccountsAndTransactions pulls all bank accounts and transactions for a Basiq User ID.
func (s *Service) FetchAccountsAndTransactions(ctx context.Context, basiqUserID string) ([]*domain.Account, []*domain.Transaction, error) {
	token, err := s.GetServerToken(ctx)
	if err != nil {
		return nil, nil, err
	}

	client, err := NewClientWithResponses("https://au-api.basiq.io", WithRequestEditorFn(func(ctx context.Context, req *http.Request) error {
		req.Header.Set("Authorization", "Bearer "+token)
		return nil
	}))
	if err != nil {
		return nil, nil, err
	}

	// 1. Fetch Accounts
	accResp, err := client.GetAccountsWithResponse(ctx, basiqUserID, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get basiq accounts: %w", err)
	}
	if accResp.StatusCode() != http.StatusOK {
		return nil, nil, fmt.Errorf("basiq accounts error (status %d): %s", accResp.StatusCode(), string(accResp.Body))
	}

	var domainAccounts []*domain.Account
	if accResp.JSON200 != nil && accResp.JSON200.Data != nil {
		for _, accData := range accResp.JSON200.Data {
			bal := parseBasiqAmount(accData.Balance)
			avail := parseBasiqAmount(accData.AvailableFunds)

			accType := domain.AccountChecking
			typeLower := strings.ToLower(string(accData.Class.Type))
			if strings.Contains(typeLower, "savings") {
				accType = domain.AccountSavings
			} else if strings.Contains(typeLower, "credit") {
				accType = domain.AccountCreditCard
			} else if strings.Contains(typeLower, "cash") {
				accType = domain.AccountCash
			}

			var lastUpdated *time.Time
			if accData.LastUpdated != "" {
				if lu, err := time.Parse(time.RFC3339, accData.LastUpdated); err == nil {
					lastUpdated = &lu
				}
			}

			domainAccounts = append(domainAccounts, &domain.Account{
				ID:             accData.Id,
				Name:           accData.DisplayName,
				Type:           accType,
				Balance:        bal,
				Class:          string(accData.Class.Type),
				AccountNo:      accData.AccountNo,
				AvailableFunds: &avail,
				Product:        accData.Class.Product,
				InstitutionID:  accData.Institution,
				ConnectionID:   accData.Connection,
				LastUpdated:    lastUpdated,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			})
		}
	}

	// 2. Fetch Transactions
	txResp, err := client.GetTransactionsWithResponse(ctx, basiqUserID, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get basiq transactions: %w", err)
	}
	if txResp.StatusCode() != http.StatusOK {
		return nil, nil, fmt.Errorf("basiq transactions error (status %d): %s", txResp.StatusCode(), string(txResp.Body))
	}

	var domainTransactions []*domain.Transaction
	if txResp.JSON200 != nil && txResp.JSON200.Data != nil {
		for _, txData := range txResp.JSON200.Data {
			amount := parseBasiqAmount(&txData.Amount)

			date, err := time.Parse(time.RFC3339, txData.TransactionDate)
			if err != nil {
				date, err = time.Parse(time.RFC3339, txData.PostDate)
				if err != nil {
					date = time.Now()
				}
			}

			var postDate *time.Time
			if txData.PostDate != "" {
				if pd, err := time.Parse(time.RFC3339, txData.PostDate); err == nil {
					postDate = &pd
				}
			}

			merchantName := ""
			if txData.Enrich.Merchant != nil {
				merchantName = txData.Enrich.Merchant.BusinessName
			}

			subClass := ""
			if txData.SubClass.Code != nil {
				subClass = *txData.SubClass.Code
			}

			domainTransactions = append(domainTransactions, &domain.Transaction{
				ID:             txData.Id,
				AccountID:      txData.Account,
				Amount:         amount,
				Description:    txData.Description,
				Date:           date,
				Direction:      string(txData.Direction),
				Status:         string(txData.Status),
				Class:          string(txData.Class),
				PostDate:       postDate,
				SubClass:       subClass,
				RawDescription: txData.Description,
				MerchantName:   merchantName,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			})
		}
	}

	return domainAccounts, domainTransactions, nil
}

func parseBasiqAmount(val *string) int64 {
	if val == nil {
		return 0
	}
	var f float64
	_, err := fmt.Sscanf(*val, "%f", &f)
	if err != nil {
		return 0
	}
	return int64(math.Round(f * 100))
}
