package postgre

import (
	"context"
	"sync"
	"sync/atomic"

	"changemedaddy/internal/app/update"
)

type Repository struct {
	ctr atomic.Int64
	m   sync.Map
}

func (r *Repository) FindByPositionID(ctx context.Context, id string) ([]*update.Update, error) {
	updates, _ := r.m.Load(id)
	if updates == nil {
		return nil, nil
	}

	old := updates.([]*update.Update)
	cpy := make([]*update.Update, len(old))
	for i, u := range old {
		old := *u
		cpy[i] = &old
	}

	return cpy, nil
}

func (r *Repository) Create(ctx context.Context, u *update.Update) (*update.Update, error) {
	copied := *u
	cpy := &copied

	cpy.ID = r.ctr.Add(1)
	r.m.Store(cpy.ID, cpy)

	return cpy, nil
}

func NewRepository() *Repository {
	return &Repository{}
}
