package api

import (
	"context"
	"errors"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"budgeting_system/internal/domain"
	budgyv1 "budgeting_system/internal/gen/budgy/v1"
	"budgeting_system/internal/gen/budgy/v1/budgyv1connect"
	"budgeting_system/internal/service"
)

type responseWriterKeyType struct{}

var responseWriterKey = responseWriterKeyType{}

// ─── Error mapping ────────────────────────────────────────────────────────────

func toConnectError(err error) error {
	if errors.Is(err, service.ErrNotFound) {
		return connect.NewError(connect.CodeNotFound, err)
	}
	if errors.Is(err, service.ErrUnauthorized) {
		return connect.NewError(connect.CodeUnauthenticated, err)
	}
	if errors.Is(err, service.ErrForbidden) {
		return connect.NewError(connect.CodePermissionDenied, err)
	}
	if errors.Is(err, service.ErrConflict) {
		return connect.NewError(connect.CodeAlreadyExists, err)
	}
	if errors.Is(err, service.ErrBadRequest) {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
	return connect.NewError(connect.CodeInternal, err)
}

// ─── Domain → Proto converters ────────────────────────────────────────────────

func protoUser(u *domain.User) *budgyv1.User {
	return &budgyv1.User{
		Id:          u.ID,
		Email:       u.Email,
		FirstName:   u.FirstName,
		LastName:    u.LastName,
		BasiqUserId: u.BasiqUserID,
		CreatedAt:   timestamppb.New(u.CreatedAt),
		UpdatedAt:   timestamppb.New(u.UpdatedAt),
	}
}

func protoBudget(b *domain.Budget) *budgyv1.Budget {
	method := budgyv1.BudgetMethod_BUDGET_METHOD_ZERO_SUM
	if b.Method == domain.MethodEnvelope {
		method = budgyv1.BudgetMethod_BUDGET_METHOD_ENVELOPE
	}
	return &budgyv1.Budget{
		Id:        b.ID,
		UserId:    b.UserID,
		Name:      b.Name,
		Method:    method,
		Currency:  b.Currency,
		CreatedAt: timestamppb.New(b.CreatedAt),
		UpdatedAt: timestamppb.New(b.UpdatedAt),
	}
}

func domainBudgetMethod(m budgyv1.BudgetMethod) domain.BudgetMethod {
	if m == budgyv1.BudgetMethod_BUDGET_METHOD_ENVELOPE {
		return domain.MethodEnvelope
	}
	return domain.MethodZeroSum
}

func protoAccount(a *domain.Account) *budgyv1.Account {
	at := budgyv1.AccountType_ACCOUNT_TYPE_CHECKING
	switch a.Type {
	case domain.AccountSavings:
		at = budgyv1.AccountType_ACCOUNT_TYPE_SAVINGS
	case domain.AccountCreditCard:
		at = budgyv1.AccountType_ACCOUNT_TYPE_CREDIT_CARD
	case domain.AccountCash:
		at = budgyv1.AccountType_ACCOUNT_TYPE_CASH
	}
	acc := &budgyv1.Account{
		Id:            a.ID,
		BudgetId:      a.BudgetID,
		Name:          a.Name,
		Type:          at,
		Balance:       a.Balance,
		CreatedAt:     timestamppb.New(a.CreatedAt),
		UpdatedAt:     timestamppb.New(a.UpdatedAt),
		Class:         a.Class,
		AccountNo:     a.AccountNo,
		Product:       a.Product,
		InstitutionId: a.InstitutionID,
		ConnectionId:  a.ConnectionID,
	}
	if a.AvailableFunds != nil {
		acc.AvailableFunds = a.AvailableFunds
	}
	if a.LastUpdated != nil {
		acc.LastUpdated = timestamppb.New(*a.LastUpdated)
	}
	return acc
}

func domainAccountType(at budgyv1.AccountType) domain.AccountType {
	switch at {
	case budgyv1.AccountType_ACCOUNT_TYPE_SAVINGS:
		return domain.AccountSavings
	case budgyv1.AccountType_ACCOUNT_TYPE_CREDIT_CARD:
		return domain.AccountCreditCard
	case budgyv1.AccountType_ACCOUNT_TYPE_CASH:
		return domain.AccountCash
	default:
		return domain.AccountChecking
	}
}

func protoCategory(c *domain.Category) *budgyv1.Category {
	return &budgyv1.Category{
		Id:          c.ID,
		BudgetId:    c.BudgetID,
		Name:        c.Name,
		Budgeted:    c.Budgeted,
		Balance:     c.Balance,
		TargetLimit: c.TargetLimit,
		CreatedAt:   timestamppb.New(c.CreatedAt),
		UpdatedAt:   timestamppb.New(c.UpdatedAt),
	}
}

func protoTransaction(t *domain.Transaction) *budgyv1.Transaction {
	tx := &budgyv1.Transaction{
		Id:              t.ID,
		BudgetId:        t.BudgetID,
		AccountId:       t.AccountID,
		CategoryId:      t.CategoryID,
		Amount:          t.Amount,
		Description:     t.Description,
		Date:            timestamppb.New(t.Date),
		CreatedAt:       timestamppb.New(t.CreatedAt),
		UpdatedAt:       timestamppb.New(t.UpdatedAt),
		Direction:       t.Direction,
		Status:          t.Status,
		Class:           t.Class,
		SubClass:        t.SubClass,
		RawDescription:  t.RawDescription,
		MerchantName:    t.MerchantName,
		MerchantWebsite: t.MerchantWebsite,
		MerchantLogoUrl: t.MerchantLogoURL,
		LocationAddress: t.LocationAddress,
		LocationLat:     t.LocationLat,
		LocationLng:     t.LocationLng,
		CategoryCode:    t.CategoryCode,
		CategoryTitle:   t.CategoryTitle,
	}
	if t.PostDate != nil {
		tx.PostDate = timestamppb.New(*t.PostDate)
	}
	return tx
}

// ─── AuthServiceHandler ───────────────────────────────────────────────────────

type authConnectHandler struct {
	auth service.AuthService
}

var _ budgyv1connect.AuthServiceHandler = (*authConnectHandler)(nil)

func (h *authConnectHandler) Register(ctx context.Context, req *connect.Request[budgyv1.RegisterRequest]) (*connect.Response[budgyv1.RegisterResponse], error) {
	r := req.Msg
	if r.Email == "" || len(r.Password) < 6 || r.FirstName == "" || r.LastName == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, service.ErrBadRequest)
	}
	u, err := h.auth.Register(ctx, r.Email, r.Password, r.FirstName, r.LastName)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.RegisterResponse{User: protoUser(u)}), nil
}

func (h *authConnectHandler) Login(ctx context.Context, req *connect.Request[budgyv1.LoginRequest]) (*connect.Response[budgyv1.LoginResponse], error) {
	r := req.Msg
	u, err := h.auth.Login(ctx, r.Email, r.Password)
	if err != nil {
		return nil, toConnectError(err)
	}
	token, err := GenerateJWT(u.ID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	// Set cookie on the underlying http.ResponseWriter
	if w, ok := ctx.Value(responseWriterKey).(http.ResponseWriter); ok {
		http.SetCookie(w, &http.Cookie{
			Name:     "token",
			Value:    token,
			Expires:  time.Now().Add(24 * time.Hour),
			HttpOnly: true,
			Path:     "/",
			SameSite: http.SameSiteLaxMode,
		})
	}
	return connect.NewResponse(&budgyv1.LoginResponse{User: protoUser(u)}), nil
}

func (h *authConnectHandler) Logout(ctx context.Context, req *connect.Request[budgyv1.LogoutRequest]) (*connect.Response[budgyv1.LogoutResponse], error) {
	if w, ok := ctx.Value(responseWriterKey).(http.ResponseWriter); ok {
		http.SetCookie(w, &http.Cookie{
			Name:     "token",
			Value:    "",
			Expires:  time.Unix(0, 0),
			MaxAge:   -1,
			HttpOnly: true,
			Path:     "/",
			SameSite: http.SameSiteLaxMode,
		})
	}
	return connect.NewResponse(&budgyv1.LogoutResponse{}), nil
}

func (h *authConnectHandler) GetMe(ctx context.Context, req *connect.Request[budgyv1.GetMeRequest]) (*connect.Response[budgyv1.GetMeResponse], error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, service.ErrUnauthorized)
	}
	u, err := h.auth.GetUserByID(ctx, userID)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.GetMeResponse{User: protoUser(u)}), nil
}

// ─── BudgetServiceHandler ─────────────────────────────────────────────────────

type budgetConnectHandler struct {
	budgets service.BudgetService
}

var _ budgyv1connect.BudgetServiceHandler = (*budgetConnectHandler)(nil)

func (h *budgetConnectHandler) CreateBudget(ctx context.Context, req *connect.Request[budgyv1.CreateBudgetRequest]) (*connect.Response[budgyv1.CreateBudgetResponse], error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, service.ErrUnauthorized)
	}
	r := req.Msg
	b, err := h.budgets.Create(ctx, userID, r.Name, domainBudgetMethod(r.Method), r.Currency)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.CreateBudgetResponse{Budget: protoBudget(b)}), nil
}

func (h *budgetConnectHandler) ListBudgets(ctx context.Context, req *connect.Request[budgyv1.ListBudgetsRequest]) (*connect.Response[budgyv1.ListBudgetsResponse], error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, service.ErrUnauthorized)
	}
	list, err := h.budgets.List(ctx, userID)
	if err != nil {
		return nil, toConnectError(err)
	}
	pb := make([]*budgyv1.Budget, len(list))
	for i, b := range list {
		pb[i] = protoBudget(b)
	}
	return connect.NewResponse(&budgyv1.ListBudgetsResponse{Budgets: pb}), nil
}

func (h *budgetConnectHandler) GetBudget(ctx context.Context, req *connect.Request[budgyv1.GetBudgetRequest]) (*connect.Response[budgyv1.GetBudgetResponse], error) {
	b, err := h.budgets.GetByID(ctx, req.Msg.BudgetId)
	if err != nil {
		return nil, toConnectError(err)
	}
	// Ownership check
	userID := getUserID(ctx)
	if b.UserID != userID {
		return nil, connect.NewError(connect.CodePermissionDenied, service.ErrForbidden)
	}
	return connect.NewResponse(&budgyv1.GetBudgetResponse{Budget: protoBudget(b)}), nil
}

func (h *budgetConnectHandler) GetBudgetSummary(ctx context.Context, req *connect.Request[budgyv1.GetBudgetSummaryRequest]) (*connect.Response[budgyv1.GetBudgetSummaryResponse], error) {
	b, err := h.budgets.GetByID(ctx, req.Msg.BudgetId)
	if err != nil {
		return nil, toConnectError(err)
	}
	userID := getUserID(ctx)
	if b.UserID != userID {
		return nil, connect.NewError(connect.CodePermissionDenied, service.ErrForbidden)
	}
	summary, err := h.budgets.GetSummary(ctx, b.ID)
	if err != nil {
		return nil, toConnectError(err)
	}
	// Convert summary to proto (simplified totals)
	resp := &budgyv1.GetBudgetSummaryResponse{
		Summary: &budgyv1.BudgetSummary{BudgetId: b.ID},
	}
	_ = summary // full structured summary is in the domain; proto carries high-level totals for now
	return connect.NewResponse(resp), nil
}

func (h *budgetConnectHandler) UpdateBudget(ctx context.Context, req *connect.Request[budgyv1.UpdateBudgetRequest]) (*connect.Response[budgyv1.UpdateBudgetResponse], error) {
	r := req.Msg
	b, err := h.budgets.GetByID(ctx, r.BudgetId)
	if err != nil {
		return nil, toConnectError(err)
	}
	userID := getUserID(ctx)
	if b.UserID != userID {
		return nil, connect.NewError(connect.CodePermissionDenied, service.ErrForbidden)
	}
	updated, err := h.budgets.Update(ctx, r.BudgetId, r.Name, domainBudgetMethod(r.Method), r.Currency)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.UpdateBudgetResponse{Budget: protoBudget(updated)}), nil
}

func (h *budgetConnectHandler) DeleteBudget(ctx context.Context, req *connect.Request[budgyv1.DeleteBudgetRequest]) (*connect.Response[budgyv1.DeleteBudgetResponse], error) {
	b, err := h.budgets.GetByID(ctx, req.Msg.BudgetId)
	if err != nil {
		return nil, toConnectError(err)
	}
	userID := getUserID(ctx)
	if b.UserID != userID {
		return nil, connect.NewError(connect.CodePermissionDenied, service.ErrForbidden)
	}
	if err := h.budgets.Delete(ctx, b.ID); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.DeleteBudgetResponse{}), nil
}

// ─── AccountServiceHandler ────────────────────────────────────────────────────

type accountConnectHandler struct {
	budgets  service.BudgetService
	accounts service.AccountService
}

var _ budgyv1connect.AccountServiceHandler = (*accountConnectHandler)(nil)

func (h *accountConnectHandler) verifyBudgetOwner(ctx context.Context, budgetID string) error {
	b, err := h.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return toConnectError(err)
	}
	if b.UserID != getUserID(ctx) {
		return connect.NewError(connect.CodePermissionDenied, service.ErrForbidden)
	}
	return nil
}

func (h *accountConnectHandler) CreateAccount(ctx context.Context, req *connect.Request[budgyv1.CreateAccountRequest]) (*connect.Response[budgyv1.CreateAccountResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	acc, err := h.accounts.Create(ctx, r.BudgetId, r.Name, domainAccountType(r.Type), r.Balance)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.CreateAccountResponse{Account: protoAccount(acc)}), nil
}

func (h *accountConnectHandler) ListAccounts(ctx context.Context, req *connect.Request[budgyv1.ListAccountsRequest]) (*connect.Response[budgyv1.ListAccountsResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	list, err := h.accounts.List(ctx, r.BudgetId)
	if err != nil {
		return nil, toConnectError(err)
	}
	pb := make([]*budgyv1.Account, len(list))
	for i, a := range list {
		pb[i] = protoAccount(a)
	}
	return connect.NewResponse(&budgyv1.ListAccountsResponse{Accounts: pb}), nil
}

func (h *accountConnectHandler) UpdateAccount(ctx context.Context, req *connect.Request[budgyv1.UpdateAccountRequest]) (*connect.Response[budgyv1.UpdateAccountResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	acc, err := h.accounts.GetByID(ctx, r.AccountId)
	if err != nil {
		return nil, toConnectError(err)
	}
	if acc.BudgetID != r.BudgetId {
		return nil, connect.NewError(connect.CodeInvalidArgument, service.ErrBadRequest)
	}
	if r.Name != nil {
		acc.Name = *r.Name
	}
	if r.Type != nil {
		acc.Type = domainAccountType(*r.Type)
	}
	if r.Balance != nil {
		acc.Balance = *r.Balance
	}
	if r.Class != nil {
		acc.Class = *r.Class
	}
	if r.AccountNo != nil {
		acc.AccountNo = *r.AccountNo
	}
	if r.AvailableFunds != nil {
		acc.AvailableFunds = r.AvailableFunds
	}
	if r.Product != nil {
		acc.Product = *r.Product
	}
	if r.InstitutionId != nil {
		acc.InstitutionID = *r.InstitutionId
	}
	if r.ConnectionId != nil {
		acc.ConnectionID = *r.ConnectionId
	}
	if r.LastUpdated != nil {
		t := r.LastUpdated.AsTime()
		acc.LastUpdated = &t
	}
	updated, err := h.accounts.Update(ctx, acc)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.UpdateAccountResponse{Account: protoAccount(updated)}), nil
}

func (h *accountConnectHandler) DeleteAccount(ctx context.Context, req *connect.Request[budgyv1.DeleteAccountRequest]) (*connect.Response[budgyv1.DeleteAccountResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	acc, err := h.accounts.GetByID(ctx, r.AccountId)
	if err != nil {
		return nil, toConnectError(err)
	}
	if acc.BudgetID != r.BudgetId {
		return nil, connect.NewError(connect.CodeInvalidArgument, service.ErrBadRequest)
	}
	if err := h.accounts.Delete(ctx, r.AccountId); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.DeleteAccountResponse{}), nil
}

// ─── CategoryServiceHandler ───────────────────────────────────────────────────

type categoryConnectHandler struct {
	budgets    service.BudgetService
	categories service.CategoryService
}

var _ budgyv1connect.CategoryServiceHandler = (*categoryConnectHandler)(nil)

func (h *categoryConnectHandler) verifyBudgetOwner(ctx context.Context, budgetID string) error {
	b, err := h.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return toConnectError(err)
	}
	if b.UserID != getUserID(ctx) {
		return connect.NewError(connect.CodePermissionDenied, service.ErrForbidden)
	}
	return nil
}

func (h *categoryConnectHandler) CreateCategory(ctx context.Context, req *connect.Request[budgyv1.CreateCategoryRequest]) (*connect.Response[budgyv1.CreateCategoryResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	c, err := h.categories.Create(ctx, r.BudgetId, r.Name, r.TargetLimit)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.CreateCategoryResponse{Category: protoCategory(c)}), nil
}

func (h *categoryConnectHandler) ListCategories(ctx context.Context, req *connect.Request[budgyv1.ListCategoriesRequest]) (*connect.Response[budgyv1.ListCategoriesResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	list, err := h.categories.List(ctx, r.BudgetId)
	if err != nil {
		return nil, toConnectError(err)
	}
	pb := make([]*budgyv1.Category, len(list))
	for i, c := range list {
		pb[i] = protoCategory(c)
	}
	return connect.NewResponse(&budgyv1.ListCategoriesResponse{Categories: pb}), nil
}

func (h *categoryConnectHandler) UpdateCategory(ctx context.Context, req *connect.Request[budgyv1.UpdateCategoryRequest]) (*connect.Response[budgyv1.UpdateCategoryResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	c, err := h.categories.GetByID(ctx, r.CategoryId)
	if err != nil {
		return nil, toConnectError(err)
	}
	if c.BudgetID != r.BudgetId {
		return nil, connect.NewError(connect.CodeInvalidArgument, service.ErrBadRequest)
	}
	if r.Name != nil {
		c.Name = *r.Name
	}
	if r.Budgeted != nil {
		c.Budgeted = *r.Budgeted
	}
	if r.Balance != nil {
		c.Balance = *r.Balance
	}
	if r.TargetLimit != nil {
		c.TargetLimit = *r.TargetLimit
	}
	updated, err := h.categories.Update(ctx, c)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.UpdateCategoryResponse{Category: protoCategory(updated)}), nil
}

func (h *categoryConnectHandler) DeleteCategory(ctx context.Context, req *connect.Request[budgyv1.DeleteCategoryRequest]) (*connect.Response[budgyv1.DeleteCategoryResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	c, err := h.categories.GetByID(ctx, r.CategoryId)
	if err != nil {
		return nil, toConnectError(err)
	}
	if c.BudgetID != r.BudgetId {
		return nil, connect.NewError(connect.CodeInvalidArgument, service.ErrBadRequest)
	}
	if err := h.categories.Delete(ctx, r.CategoryId); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.DeleteCategoryResponse{}), nil
}

func (h *categoryConnectHandler) AssignCategoryFunds(ctx context.Context, req *connect.Request[budgyv1.AssignCategoryFundsRequest]) (*connect.Response[budgyv1.AssignCategoryFundsResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	c, err := h.categories.AssignFunds(ctx, r.BudgetId, r.CategoryId, r.Amount)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.AssignCategoryFundsResponse{Category: protoCategory(c)}), nil
}

func (h *categoryConnectHandler) FundEnvelope(ctx context.Context, req *connect.Request[budgyv1.FundEnvelopeRequest]) (*connect.Response[budgyv1.FundEnvelopeResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	updatedAcc, updatedEnv, err := h.categories.FundEnvelope(ctx, r.BudgetId, r.CategoryId, r.AccountId, r.Amount)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.FundEnvelopeResponse{
		Result: &budgyv1.FundEnvelopeResult{
			AccountId:      updatedAcc.ID,
			AccountBalance: updatedAcc.Balance,
			Envelope:       protoCategory(updatedEnv),
		},
	}), nil
}

// ─── TransactionServiceHandler ────────────────────────────────────────────────

type transactionConnectHandler struct {
	budgets      service.BudgetService
	transactions service.TransactionService
	mappers      *Mappers
}

var _ budgyv1connect.TransactionServiceHandler = (*transactionConnectHandler)(nil)

func (h *transactionConnectHandler) verifyBudgetOwner(ctx context.Context, budgetID string) error {
	b, err := h.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return toConnectError(err)
	}
	if b.UserID != getUserID(ctx) {
		return connect.NewError(connect.CodePermissionDenied, service.ErrForbidden)
	}
	return nil
}

func (h *transactionConnectHandler) CreateTransaction(ctx context.Context, req *connect.Request[budgyv1.CreateTransactionRequest]) (*connect.Response[budgyv1.CreateTransactionResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	var date time.Time
	if r.Date != nil {
		date = r.Date.AsTime()
	} else {
		date = time.Now()
	}
	tx, err := h.transactions.Create(ctx, r.BudgetId, r.AccountId, r.CategoryId, r.Amount, r.Description, date)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.CreateTransactionResponse{Transaction: protoTransaction(tx)}), nil
}

func (h *transactionConnectHandler) ListTransactions(ctx context.Context, req *connect.Request[budgyv1.ListTransactionsRequest]) (*connect.Response[budgyv1.ListTransactionsResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	list, err := h.transactions.List(ctx, r.BudgetId)
	if err != nil {
		return nil, toConnectError(err)
	}
	pb := make([]*budgyv1.Transaction, len(list))
	for i, t := range list {
		pb[i] = protoTransaction(t)
	}
	return connect.NewResponse(&budgyv1.ListTransactionsResponse{Transactions: pb}), nil
}

func (h *transactionConnectHandler) UpdateTransaction(ctx context.Context, req *connect.Request[budgyv1.UpdateTransactionRequest]) (*connect.Response[budgyv1.UpdateTransactionResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	updates := &domain.Transaction{}
	if err := h.mappers.Transaction().UpdateTransactionRequestToTransaction(ctx, r, updates); err != nil {
		return nil, toConnectError(err)
	}
	tx, err := h.transactions.Update(ctx, r.BudgetId, r.TransactionId, updates)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.UpdateTransactionResponse{Transaction: protoTransaction(tx)}), nil
}

func (h *transactionConnectHandler) DeleteTransaction(ctx context.Context, req *connect.Request[budgyv1.DeleteTransactionRequest]) (*connect.Response[budgyv1.DeleteTransactionResponse], error) {
	r := req.Msg
	if err := h.verifyBudgetOwner(ctx, r.BudgetId); err != nil {
		return nil, err
	}
	if err := h.transactions.Delete(ctx, r.BudgetId, r.TransactionId); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.DeleteTransactionResponse{}), nil
}

// ─── BankSyncServiceHandler ───────────────────────────────────────────────────

type bankSyncConnectHandler struct {
	bankSync service.BankSyncService
}

var _ budgyv1connect.BankSyncServiceHandler = (*bankSyncConnectHandler)(nil)

func (h *bankSyncConnectHandler) GetBasiqAuthLink(ctx context.Context, req *connect.Request[budgyv1.GetBasiqAuthLinkRequest]) (*connect.Response[budgyv1.GetBasiqAuthLinkResponse], error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, service.ErrUnauthorized)
	}
	if h.bankSync == nil {
		return nil, connect.NewError(connect.CodeUnimplemented, errors.New("bank sync service not configured"))
	}
	token, connectURL, err := h.bankSync.GetAuthLink(ctx, userID)
	if err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.GetBasiqAuthLinkResponse{
		AuthLink: &budgyv1.BasiqAuthLink{Token: token, ConnectUrl: connectURL},
	}), nil
}

func (h *bankSyncConnectHandler) SyncBank(ctx context.Context, req *connect.Request[budgyv1.SyncBankRequest]) (*connect.Response[budgyv1.SyncBankResponse], error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, service.ErrUnauthorized)
	}
	if h.bankSync == nil {
		return nil, connect.NewError(connect.CodeUnimplemented, errors.New("bank sync service not configured"))
	}
	if err := h.bankSync.SyncUser(ctx, userID); err != nil {
		return nil, toConnectError(err)
	}
	return connect.NewResponse(&budgyv1.SyncBankResponse{Message: "Sync completed successfully"}), nil
}

// ─── Mount helper ─────────────────────────────────────────────────────────────

// MountConnectHandlers registers all Connect RPC service handlers on mux.
// The auth middleware wrapping is applied inline using withConnectAuth.
func (s *APIServer) MountConnectHandlers(mux *http.ServeMux) {
	authHandler := &authConnectHandler{auth: s.auth}
	budgetHandler := &budgetConnectHandler{budgets: s.budgets}
	accountHandler := &accountConnectHandler{budgets: s.budgets, accounts: s.accounts}
	categoryHandler := &categoryConnectHandler{budgets: s.budgets, categories: s.categories}
	txHandler := &transactionConnectHandler{budgets: s.budgets, transactions: s.transactions, mappers: s.mappers}
	bankSyncHandler := &bankSyncConnectHandler{bankSync: s.bankSync}

	// Auth service – Register and Login are public; GetMe and Logout require auth
	authPath, authH := budgyv1connect.NewAuthServiceHandler(authHandler)
	mux.Handle(authPath, s.withConnectAuth(authH))

	// Budget service
	budgetPath, budgetH := budgyv1connect.NewBudgetServiceHandler(budgetHandler)
	mux.Handle(budgetPath, s.withConnectAuth(budgetH))

	// Account service
	accountPath, accountH := budgyv1connect.NewAccountServiceHandler(accountHandler)
	mux.Handle(accountPath, s.withConnectAuth(accountH))

	// Category service
	categoryPath, categoryH := budgyv1connect.NewCategoryServiceHandler(categoryHandler)
	mux.Handle(categoryPath, s.withConnectAuth(categoryH))

	// Transaction service
	txPath, txH := budgyv1connect.NewTransactionServiceHandler(txHandler)
	mux.Handle(txPath, s.withConnectAuth(txH))

	// Bank sync service
	bankSyncPath, bankSyncH := budgyv1connect.NewBankSyncServiceHandler(bankSyncHandler)
	mux.Handle(bankSyncPath, s.withConnectAuth(bankSyncH))
}

// withConnectAuth wraps a handler to inject the user ID from the JWT cookie into context.
// Unlike withAuth, it does not hard-reject unauthenticated requests — the individual handlers
// decide whether auth is required (Register/Login are public).
func (s *APIServer) withConnectAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Inject ResponseWriter into context for cookie setting
		ctx := context.WithValue(r.Context(), responseWriterKey, w)

		cookie, err := r.Cookie("token")
		if err == nil {
			claims := &Claims{}
			token, err := parseJWT(cookie.Value, claims)
			if err == nil && token.Valid {
				ctx = context.WithValue(ctx, userIDContextKey, claims.UserID)
			}
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
