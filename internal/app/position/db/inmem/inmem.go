package inmem

import (
	"context"
	"slices"
	"sync"

	"changemedaddy/internal/app/position"
)

type Repository struct {
	m sync.Map
}

func (r *Repository) FindByID(ctx context.Context, id string) (*position.Position, error) {
	p, _ := r.m.Load(id)
	if p == nil {
		return nil, nil
	}

	// this code emulates taking a Position from a real database
	copied := *(p.(*position.Position))
	cpy := &copied
	cpy.Lots = slices.Clone(cpy.Lots)

	return cpy, nil
}

func (r *Repository) Create(ctx context.Context, p *position.Position) (*position.Position, error) {
	copied := *p
	cpy := &copied

	cpy.ID = p.CreatedByID + "-" + p.Slug
	cpy.Lots = slices.Clone(p.Lots)

	r.m.Store(cpy.ID, cpy)

	return cpy, nil
}

func (r *Repository) Update(ctx context.Context, p *position.Position) (*position.Position, error) {
	copied := *p
	cpy := &copied

	cpy.Lots = slices.Clone(p.Lots)

	_, ok := r.m.Load(p.ID)
	if !ok {
		return nil, nil
	}
	r.m.Store(cpy.ID, cpy)

	return cpy, nil
}

func NewRepository() *Repository {
	return &Repository{}
}
