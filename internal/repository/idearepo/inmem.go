package idearepo

import (
	"changemedaddy/internal/aggregate/idea"
	"context"
	"sync"
)

type inmem struct {
	mu    sync.RWMutex
	ideas []*idea.Idea
}

func NewInMem() *inmem {
	return &inmem{}
}

func (m *inmem) Save(_ context.Context, i *idea.Idea) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	i.ID = len(m.ideas)
	m.ideas = append(m.ideas, i)

	return nil
}

func (i *inmem) Find(_ context.Context, id int) (*idea.Idea, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	if id < 0 || id >= len(i.ideas) {
		return nil, idea.ErrNotFound
	}

	return i.ideas[id], nil
}

func (i *inmem) Update(_ context.Context, p *idea.Idea) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if p.ID < 0 || p.ID >= len(i.ideas) {
		return idea.ErrNotFound
	}

	i.ideas[p.ID] = p
	return nil
}

func (i *inmem) FindByAnalystID(_ context.Context, id int) ([]*idea.Idea, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	var ideas []*idea.Idea
	for _, i := range i.ideas {
		ideas = append(ideas, i)
	}

	return ideas, nil
}

func (i *inmem) FindBySlug(ctx context.Context, analystID int, slug string) (*idea.Idea, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	for _, i := range i.ideas {
		if i.AuthorID == analystID && i.Slug == slug {
			return i, nil
		}
	}

	return nil, idea.ErrNotFound
}
