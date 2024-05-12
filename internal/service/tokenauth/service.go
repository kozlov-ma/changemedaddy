package tokenauth

import (
	"changemedaddy/internal/aggregate/analyst"
	"context"
	"errors"
	"fmt"
	"log/slog"
)

type analystRepo interface {
	Save(ctx context.Context, a *analyst.Analyst) error
	FindBySlug(ctx context.Context, slug string) (*analyst.Analyst, error)
}

type tokenRepo interface {
	SlugFromToken(ctx context.Context, token string) (string, error)
	RegisterAs(ctx context.Context, token, slug string) error
}

type service struct {
	log *slog.Logger
	tr  tokenRepo
	ar  analystRepo
}

func (f *service) Auth(ctx context.Context, token string) (*analyst.Analyst, error) {
	slug, err := f.tr.SlugFromToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("couldn't get slug (token %q): %w", token, err)
	}

	a, err := f.ar.FindBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("couldn't find analyst: %w", err)
	}

	return a, nil
}

func (f *service) RegisterAs(ctx context.Context, token, name string) error {
	_, err := f.tr.SlugFromToken(ctx, token)
	if err == nil {
		return analyst.ErrDuplicateToken
	} else if errors.Is(err, analyst.ErrWrongToken) || errors.Is(err, analyst.ErrDuplicateToken) {
		return err
	} else if err != analyst.ErrNotFound {
		return fmt.Errorf("couldn't verify token: %w", err)
	}

	an, err := analyst.New(context.Background(), f.ar, analyst.CreationOptions{Name: name})
	if err != nil {
		return fmt.Errorf("couldn't create analyst: %w", err)
	}

	if err := f.tr.RegisterAs(context.Background(), token, an.Slug); err != nil {
		return fmt.Errorf("couldn't register token: %w", err)
	}

	f.log.DebugContext(ctx, "registered token-slug pair", "token", token, "slug", an.Slug)
	return nil
}

func New(log *slog.Logger, ar analystRepo, tr tokenRepo) *service {
	return &service{
		log: log,
		tr:  tr,
		ar:  ar,
	}
}
