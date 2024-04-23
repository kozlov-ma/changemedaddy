package idearepo

import (
	"changemedaddy/internal/model"
	"changemedaddy/internal/pkg/fixable"
	"changemedaddy/internal/service/idea"
	"context"
	"sync"
)

type inmem struct {
	mu    sync.RWMutex
	ideas []*model.Idea
}

func NewInMem() *inmem {
	return &inmem{}
}

func (i *inmem) Create(_ context.Context, idea *model.Idea) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	idea.ID = len(i.ideas)*3131 + 313131
	i.ideas = append(i.ideas, idea)
	return nil
}

func (i *inmem) FindOne(_ context.Context, req idea.FindRequest) (*model.Idea, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	for _, i := range i.ideas {
		conds := true
		conds = conds && (req.ID == 0 || i.ID == req.ID)
		conds = conds && (req.Slug == "" || req.Slug == i.Slug)

		if conds {
			return i, nil
		}
	}

	return nil, nil
}

func (i *inmem) Update(_ context.Context, idea *model.Idea) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	for idx, ie := range i.ideas {
		if ie.ID == idea.ID {
			i.ideas[idx] = idea
			return nil
		}
	}

	return fixable.ErrIdeaNotFound
}
