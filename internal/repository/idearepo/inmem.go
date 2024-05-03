package idearepo

import (
	"changemedaddy/internal/aggregate/idea"
	"context"
	"sync"
)

type inmem struct {
	mu sync.RWMutex
	ii []*idea.Idea
}

func NewInMem() *inmem {
	return &inmem{}
}

func (m *inmem) Save(_ context.Context, i *idea.Idea) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	i.ID = len(m.ii)
	m.ii = append(m.ii, i)

	return nil
}

func (i *inmem) Find(_ context.Context, id int) (*idea.Idea, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	if id < 0 || id >= len(i.ii) {
		return nil, idea.ErrNotFound
	}

	return i.ii[id], nil
}

func (i *inmem) Update(_ context.Context, p *idea.Idea) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if p.ID < 0 || p.ID >= len(i.ii) {
		return idea.ErrNotFound
	}

	i.ii[p.ID] = p
	return nil
}
