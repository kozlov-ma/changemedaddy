package analystrepo

import (
	"changemedaddy/internal/aggregate/analyst"
	"context"
	"sync"
)

type inmem struct {
	mu sync.RWMutex
	aa []*analyst.Analyst
}

func NewInmem() *inmem {
	return &inmem{}
}

func (i *inmem) Save(_ context.Context, new *analyst.Analyst) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	for _, a := range i.aa {
		if a.Slug == new.Slug {
			return analyst.ErrDuplicateName
		}
	}

	new.ID = len(i.aa)
	i.aa = append(i.aa, new)

	return nil
}

func (i *inmem) Find(_ context.Context, id int) (*analyst.Analyst, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	if id < 0 || id >= len(i.aa) {
		return nil, analyst.ErrNotFound
	}

	return i.aa[id], nil
}

func (i *inmem) FindBySlug(_ context.Context, slug string) (*analyst.Analyst, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	for _, a := range i.aa {
		if a.Slug == slug {
			return a, nil
		}
	}

	return nil, analyst.ErrNotFound
}
