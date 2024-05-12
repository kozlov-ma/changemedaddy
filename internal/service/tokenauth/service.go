package tokenauth

import (
	"changemedaddy/internal/aggregate/analyst"
	"context"
	"fmt"
	"sync"
)

type analystRepo interface {
	Save(ctx context.Context, a *analyst.Analyst) error
	FindBySlug(ctx context.Context, slug string) (*analyst.Analyst, error)
}

type fakeService struct {
	mu          sync.Mutex
	tokenToSlug map[string]string
	regAs       map[string]string
	ar          analystRepo
}

func (f *fakeService) Auth(ctx context.Context, token string) (*analyst.Analyst, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	slug, ok := f.tokenToSlug[token]
	if !ok {
		regAs, ok := f.regAs[token]
		if !ok {
			return nil, analyst.ErrWrongToken
		}

		newAn, err := analyst.New(ctx, f.ar, analyst.CreationOptions{
			Name: regAs,
		})

		f.tokenToSlug[token] = newAn.Slug

		if err != nil {
			return nil, fmt.Errorf("couldn't create analyst (token %q): %w", token, err)
		}

		return newAn, nil
	}

	a, err := f.ar.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}

	return a, nil
}

func (f *fakeService) RegisterAs(token, name string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.regAs[token] = name
}

func NewFake(ar analystRepo) *fakeService {
	return &fakeService{
		tokenToSlug: make(map[string]string),
		regAs:       make(map[string]string),
		ar:          ar,
	}
}
