package idearepo

import (
	"changemedaddy/internal/domain/idea"
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

func (i *inmem) Create(_ context.Context, idea *idea.Idea) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	i.ideas = append(i.ideas, idea)
	return nil
}

func (i *inmem) FindOne(_ context.Context, analystSlug, ideaSlug string) (*idea.Idea, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	for _, i := range i.ideas {
		if i.Analyst.Slug == analystSlug && i.Slug == ideaSlug {
			return i, nil
		}
	}

	return nil, nil
}
