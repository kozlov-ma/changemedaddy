package positionrepo

import (
	"changemedaddy/internal/domain/position"
	"context"
	"sync"
)

type inmem struct {
	mu sync.RWMutex
	pp []*position.Position
}

func NewInMem() *inmem {
	return &inmem{}
}

func (i *inmem) Save(_ context.Context, p *position.Position) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	p.ID = len(i.pp)
	i.pp = append(i.pp, p)

	return nil
}

func (i *inmem) Find(_ context.Context, id int) (*position.Position, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	if id < 0 || id >= len(i.pp) {
		return nil, position.ErrNotFound
	}

	return i.pp[id], nil
}

func (i *inmem) Update(_ context.Context, p *position.Position) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if p.ID < 0 || p.ID >= len(i.pp) {
		return position.ErrNotFound
	}

	i.pp[p.ID] = p
	return nil
}
