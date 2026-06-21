package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"

	"golang.org/x/crypto/bcrypt"
)

type authService struct {
	users  domain.UserRepository
	seeder CategorySeeder
}

func NewAuthService(users domain.UserRepository, seeder CategorySeeder) AuthService {
	return &authService{users: users, seeder: seeder}
}

func (s *authService) Register(ctx context.Context, email, password, firstName, lastName string) (*domain.User, error) {
	existing, err := s.users.GetByEmail(ctx, email)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("%w: user with this email already exists", ErrConflict)
	}

	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &domain.User{
		ID:           generateID(),
		Email:        email,
		PasswordHash: string(bytes),
		FirstName:    firstName,
		LastName:     lastName,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}
	if s.seeder != nil {
		if err := s.seeder.SeedCategoriesForUser(ctx, user.ID); err != nil {
			return nil, fmt.Errorf("failed to seed categories: %w", err)
		}
	}
	return user, nil
}

func (s *authService) Login(ctx context.Context, email, password string) (*domain.User, error) {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid credentials", ErrUnauthorized)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("%w: invalid credentials", ErrUnauthorized)
	}
	return user, nil
}

func (s *authService) GetUserByID(ctx context.Context, userID string) (*domain.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user not found", ErrNotFound)
	}
	return user, nil
}

func (s *authService) GetUserByBasiqUserID(ctx context.Context, basiqUserID string) (*domain.User, error) {
	user, err := s.users.GetByBasiqUserID(ctx, basiqUserID)
	if err != nil {
		return nil, fmt.Errorf("%w: user not found", ErrNotFound)
	}
	return user, nil
}
