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
