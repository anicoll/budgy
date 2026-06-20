package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"
)

type categoryService struct {
	categories domain.CategoryRepository
}

func NewCategoryService(categories domain.CategoryRepository) CategoryService {
	return &categoryService{categories: categories}
}

func (s *categoryService) Create(ctx context.Context, userID string, cat *domain.Category) (*domain.Category, error) {
	c := &domain.Category{
		ID:                generateID(),
		UserID:            userID,
		ParentID:          cat.ParentID,
		Name:              cat.Name,
		Type:              cat.Type,
		Color:             cat.Color,
		Icon:              cat.Icon,
		SortOrder:         cat.SortOrder,
		Archived:          cat.Archived,
		System:            false,
		BasiqSubClassCode: cat.BasiqSubClassCode,
		AnzsicClassCode:   cat.AnzsicClassCode,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	if c.Color == "" {
		c.Color = "#7c5cff"
	}
	if c.Type == "" {
		c.Type = domain.CategoryExpense
	}
	if err := c.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.categories.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *categoryService) List(ctx context.Context, userID string) ([]*domain.Category, error) {
	return s.categories.ListByUser(ctx, userID)
}

func (s *categoryService) GetByID(ctx context.Context, id string) (*domain.Category, error) {
	c, err := s.categories.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: category not found", ErrNotFound)
	}
	return c, nil
}

func (s *categoryService) Update(ctx context.Context, cat *domain.Category) (*domain.Category, error) {
	existing, err := s.GetByID(ctx, cat.ID)
	if err != nil {
		return nil, err
	}
	if existing.System {
		return nil, fmt.Errorf("%w: system categories cannot be modified", ErrBadRequest)
	}
	cat.UpdatedAt = time.Now()
	if err := cat.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.categories.Update(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *categoryService) Delete(ctx context.Context, id string) error {
	c, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if c.System {
		return fmt.Errorf("%w: system categories cannot be deleted", ErrBadRequest)
	}
	return s.categories.Delete(ctx, id)
}
