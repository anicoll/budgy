package api

import (
	"budgeting_system/internal/domain"
	budgyv1 "budgeting_system/internal/gen/budgy/v1"
	"budgeting_system/internal/mappings"
	"budgeting_system/pkg/utils"
	"context"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

// Mappers is a container for all application mappers.
type Mappers struct {
	txMapper       mappings.TransactionMapper
	userMapper     mappings.UserMapper
	budgetMapper   mappings.BudgetMapper
	accountMapper  mappings.AccountMapper
	categoryMapper mappings.CategoryMapper
	txProtoMapper  mappings.TransactionProtoMapper
}

// InitMappers creates and returns an initialized Mappers instance.
func InitMappers() *Mappers {
	mappers := mappings.NewMappers()
	mappers.Add("TimestampConverter", &TimestampConverter{})
	mappers.Add("EnumConverter", &EnumConverter{})

	return &Mappers{
		txMapper:       utils.Must(mappers.Get("budgeting_system/internal/mappings.TransactionMapper")).(mappings.TransactionMapper),
		userMapper:     utils.Must(mappers.Get("budgeting_system/internal/mappings.UserMapper")).(mappings.UserMapper),
		budgetMapper:   utils.Must(mappers.Get("budgeting_system/internal/mappings.BudgetMapper")).(mappings.BudgetMapper),
		accountMapper:  utils.Must(mappers.Get("budgeting_system/internal/mappings.AccountMapper")).(mappings.AccountMapper),
		categoryMapper: utils.Must(mappers.Get("budgeting_system/internal/mappings.CategoryMapper")).(mappings.CategoryMapper),
		txProtoMapper:  utils.Must(mappers.Get("budgeting_system/internal/mappings.TransactionProtoMapper")).(mappings.TransactionProtoMapper),
	}
}

// Transaction returns the TransactionMapper.
func (m *Mappers) Transaction() mappings.TransactionMapper {
	return m.txMapper
}

// User converts domain.User to budgyv1.User.
func (m *Mappers) User(ctx context.Context, u *domain.User) *budgyv1.User {
	if u == nil {
		return nil
	}
	var p budgyv1.User
	if err := m.userMapper.ToProto(ctx, u, &p); err != nil {
		panic(err)
	}
	return &p
}

// Budget converts domain.Budget to budgyv1.Budget.
func (m *Mappers) Budget(ctx context.Context, b *domain.Budget) *budgyv1.Budget {
	if b == nil {
		return nil
	}
	var p budgyv1.Budget
	if err := m.budgetMapper.ToProto(ctx, b, &p); err != nil {
		panic(err)
	}
	return &p
}

// Account converts domain.Account to budgyv1.Account.
func (m *Mappers) Account(ctx context.Context, a *domain.Account) *budgyv1.Account {
	if a == nil {
		return nil
	}
	var p budgyv1.Account
	if err := m.accountMapper.ToProto(ctx, a, &p); err != nil {
		panic(err)
	}
	return &p
}

// Category converts domain.Category to budgyv1.Category.
func (m *Mappers) Category(ctx context.Context, c *domain.Category) *budgyv1.Category {
	if c == nil {
		return nil
	}
	var p budgyv1.Category
	if err := m.categoryMapper.ToProto(ctx, c, &p); err != nil {
		panic(err)
	}
	return &p
}

// BudgetCategory converts domain.BudgetCategory to budgyv1.BudgetCategory.
func (m *Mappers) BudgetCategory(ctx context.Context, bc *domain.BudgetCategory) *budgyv1.BudgetCategory {
	if bc == nil {
		return nil
	}
	return &budgyv1.BudgetCategory{
		Category:          m.Category(ctx, &bc.Category),
		Budgeted:          bc.Budgeted,
		Balance:           bc.Balance,
		TargetLimit:       bc.TargetLimit,
		BudgetedFrequency: budgetFrequencyToProto(bc.BudgetedFrequency),
	}
}

func budgetFrequencyToProto(f domain.BudgetFrequency) budgyv1.BudgetFrequency {
	switch f {
	case domain.FrequencyWeekly:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_WEEKLY
	case domain.FrequencyFortnightly:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_FORTNIGHTLY
	case domain.FrequencyQuarterly:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_QUARTERLY
	case domain.FrequencyYearly:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_YEARLY
	default:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_MONTHLY
	}
}

// TransactionProto converts domain.Transaction to budgyv1.Transaction.
func (m *Mappers) TransactionProto(ctx context.Context, t *domain.Transaction) *budgyv1.Transaction {
	if t == nil {
		return nil
	}
	var p budgyv1.Transaction
	if err := m.txProtoMapper.ToProto(ctx, t, &p); err != nil {
		panic(err)
	}
	p.CategoryId = t.EffectiveCategoryID()
	p.BasiqCategoryId = t.CategoryID
	p.CustomerCategoryId = t.CustomerCategoryID
	return &p
}

// TimestampConverter converts between *timestamppb.Timestamp and time.Time / *time.Time.
type TimestampConverter struct{}

// TimestampToTime converts *timestamppb.Timestamp to *time.Time.
func (c *TimestampConverter) TimestampToTime(ctx context.Context, source *timestamppb.Timestamp) (*time.Time, error) {
	if source == nil {
		return nil, nil
	}
	t := source.AsTime()
	return &t, nil
}

// TimeToTimestamp converts *time.Time to *timestamppb.Timestamp.
func (c *TimestampConverter) TimeToTimestamp(ctx context.Context, source *time.Time) (*timestamppb.Timestamp, error) {
	if source == nil {
		return nil, nil
	}
	return timestamppb.New(*source), nil
}

// EnumConverter converts between domain enums and protobuf enums.
type EnumConverter struct{}

func (c *EnumConverter) MethodToProto(ctx context.Context, source *domain.BudgetMethod) (budgyv1.BudgetMethod, bool, error) {
	if source == nil {
		return budgyv1.BudgetMethod_BUDGET_METHOD_UNSPECIFIED, true, nil
	}
	if *source == domain.MethodEnvelope {
		return budgyv1.BudgetMethod_BUDGET_METHOD_ENVELOPE, false, nil
	}
	return budgyv1.BudgetMethod_BUDGET_METHOD_ZERO_SUM, false, nil
}

func (c *EnumConverter) PeriodToProto(ctx context.Context, source *domain.BudgetPeriod) (budgyv1.BudgetPeriod, bool, error) {
	if source == nil || *source == "" {
		return budgyv1.BudgetPeriod_BUDGET_PERIOD_MONTHLY, true, nil
	}
	switch *source {
	case domain.PeriodWeekly:
		return budgyv1.BudgetPeriod_BUDGET_PERIOD_WEEKLY, false, nil
	case domain.PeriodFortnightly:
		return budgyv1.BudgetPeriod_BUDGET_PERIOD_FORTNIGHTLY, false, nil
	default:
		return budgyv1.BudgetPeriod_BUDGET_PERIOD_MONTHLY, false, nil
	}
}

func (c *EnumConverter) FrequencyToProto(ctx context.Context, source *domain.BudgetFrequency) (budgyv1.BudgetFrequency, bool, error) {
	if source == nil || *source == "" {
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_MONTHLY, true, nil
	}
	switch *source {
	case domain.FrequencyWeekly:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_WEEKLY, false, nil
	case domain.FrequencyFortnightly:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_FORTNIGHTLY, false, nil
	case domain.FrequencyQuarterly:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_QUARTERLY, false, nil
	case domain.FrequencyYearly:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_YEARLY, false, nil
	default:
		return budgyv1.BudgetFrequency_BUDGET_FREQUENCY_MONTHLY, false, nil
	}
}

func (c *EnumConverter) ProtoToMethod(ctx context.Context, source *budgyv1.BudgetMethod) (domain.BudgetMethod, bool, error) {
	if source == nil {
		return domain.MethodZeroSum, true, nil
	}
	if *source == budgyv1.BudgetMethod_BUDGET_METHOD_ENVELOPE {
		return domain.MethodEnvelope, false, nil
	}
	return domain.MethodZeroSum, false, nil
}

func (c *EnumConverter) AccountTypeToProto(ctx context.Context, source *domain.AccountType) (budgyv1.AccountType, bool, error) {
	if source == nil {
		return budgyv1.AccountType_ACCOUNT_TYPE_CHECKING, true, nil
	}
	switch *source {
	case domain.AccountSavings:
		return budgyv1.AccountType_ACCOUNT_TYPE_SAVINGS, false, nil
	case domain.AccountCreditCard:
		return budgyv1.AccountType_ACCOUNT_TYPE_CREDIT_CARD, false, nil
	case domain.AccountCash:
		return budgyv1.AccountType_ACCOUNT_TYPE_CASH, false, nil
	default:
		return budgyv1.AccountType_ACCOUNT_TYPE_CHECKING, false, nil
	}
}

func (c *EnumConverter) ProtoToAccountType(ctx context.Context, source *budgyv1.AccountType) (domain.AccountType, bool, error) {
	if source == nil {
		return domain.AccountChecking, true, nil
	}
	switch *source {
	case budgyv1.AccountType_ACCOUNT_TYPE_SAVINGS:
		return domain.AccountSavings, false, nil
	case budgyv1.AccountType_ACCOUNT_TYPE_CREDIT_CARD:
		return domain.AccountCreditCard, false, nil
	case budgyv1.AccountType_ACCOUNT_TYPE_CASH:
		return domain.AccountCash, false, nil
	default:
		return domain.AccountChecking, false, nil
	}
}

func (c *EnumConverter) CategoryTypeToProto(ctx context.Context, source *domain.CategoryType) (budgyv1.CategoryType, bool, error) {
	if source == nil {
		return budgyv1.CategoryType_CATEGORY_TYPE_EXPENSE, true, nil
	}
	switch *source {
	case domain.CategoryIncome:
		return budgyv1.CategoryType_CATEGORY_TYPE_INCOME, false, nil
	case domain.CategoryTransfer:
		return budgyv1.CategoryType_CATEGORY_TYPE_TRANSFER, false, nil
	default:
		return budgyv1.CategoryType_CATEGORY_TYPE_EXPENSE, false, nil
	}
}

func domainCategoryType(ct budgyv1.CategoryType) domain.CategoryType {
	switch ct {
	case budgyv1.CategoryType_CATEGORY_TYPE_INCOME:
		return domain.CategoryIncome
	case budgyv1.CategoryType_CATEGORY_TYPE_TRANSFER:
		return domain.CategoryTransfer
	default:
		return domain.CategoryExpense
	}
}
