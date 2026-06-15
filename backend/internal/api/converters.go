package api

import (
	"budgeting_system/internal/domain"
	budgyv1 "budgeting_system/internal/gen/budgy/v1"
	"budgeting_system/internal/mappings"
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

	tx, err := mappers.Get("budgeting_system/internal/mappings.TransactionMapper")
	if err != nil {
		panic(err)
	}
	user, err := mappers.Get("budgeting_system/internal/mappings.UserMapper")
	if err != nil {
		panic(err)
	}
	budget, err := mappers.Get("budgeting_system/internal/mappings.BudgetMapper")
	if err != nil {
		panic(err)
	}
	account, err := mappers.Get("budgeting_system/internal/mappings.AccountMapper")
	if err != nil {
		panic(err)
	}
	category, err := mappers.Get("budgeting_system/internal/mappings.CategoryMapper")
	if err != nil {
		panic(err)
	}
	txProto, err := mappers.Get("budgeting_system/internal/mappings.TransactionProtoMapper")
	if err != nil {
		panic(err)
	}

	return &Mappers{
		txMapper:       tx.(mappings.TransactionMapper),
		userMapper:     user.(mappings.UserMapper),
		budgetMapper:   budget.(mappings.BudgetMapper),
		accountMapper:  account.(mappings.AccountMapper),
		categoryMapper: category.(mappings.CategoryMapper),
		txProtoMapper:  txProto.(mappings.TransactionProtoMapper),
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

// TransactionProto converts domain.Transaction to budgyv1.Transaction.
func (m *Mappers) TransactionProto(ctx context.Context, t *domain.Transaction) *budgyv1.Transaction {
	if t == nil {
		return nil
	}
	var p budgyv1.Transaction
	if err := m.txProtoMapper.ToProto(ctx, t, &p); err != nil {
		panic(err)
	}
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

// TimeToTimestamp converts time.Time to *timestamppb.Timestamp.
func (c *TimestampConverter) TimeToTimestamp(ctx context.Context, source time.Time) (*timestamppb.Timestamp, error) {
	return timestamppb.New(source), nil
}

// PtrTimeToTimestamp converts *time.Time to *timestamppb.Timestamp.
func (c *TimestampConverter) PtrTimeToTimestamp(ctx context.Context, source *time.Time) (*timestamppb.Timestamp, error) {
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
