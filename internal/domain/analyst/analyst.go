package analyst

import (
	"changemedaddy/internal/domain/idea"
	"context"
)

type Analyst struct {
	Slug string
	Name string
}

type ideaProvider interface {
	FindOne(ctx context.Context, analystSlug string, ideaSlug string) (*idea.Idea, error)
}

func (a *Analyst) IdeaBySlug(ctx context.Context, ip ideaProvider, slug string) (*idea.Idea, error) {
	return ip.FindOne(ctx, a.Slug, slug)
}
