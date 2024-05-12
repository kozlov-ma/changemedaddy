package analyst

import (
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/pkg/assert"
	"context"
	"errors"
	"fmt"

	"github.com/gosimple/slug"
)

type Analyst struct {
	Slug string `bson:"slug"`
	Name string `bson:"name"`
}

type analystSaver interface {
	Save(ctx context.Context, a *Analyst) error
}

func (a *Analyst) Save(ctx context.Context, as analystSaver) error {
	return as.Save(ctx, a)
}

type CreationOptions struct {
	Name string `form:"name"`
}

func New(ctx context.Context, as analystSaver, co CreationOptions) (*Analyst, error) {
	if len(co.Name) < 2 {
		return nil, ErrNameTooShort
	} else if len(co.Name) > 55 {
		return nil, ErrNameTooLong
	}

	a := &Analyst{
		Slug: slug.Make(co.Name),
		Name: co.Name,
	}

	assert.That(len(a.Slug) >= 2, fmt.Sprintf("slug was shorter than the limit, name %q, slug %q", a.Name, a.Slug))

	err := a.Save(ctx, as)
	if errors.Is(err, ErrDuplicateName) {
		return nil, err
	} else if err != nil {
		return nil, fmt.Errorf("couldn't create analyst (name %q): %w", co.Name, err)
	}

	return a, err
}

type ideaSaver interface {
	Save(ctx context.Context, i *idea.Idea) error
}

type IdeaCreationOptions struct {
	Name       string `form:"name"`
	SourceLink string `form:"source_link"`
}

func (a *Analyst) NewIdea(ctx context.Context, is ideaSaver, io IdeaCreationOptions) (*idea.Idea, error) {
	opt := idea.CreationOptions{
		Name:       io.Name,
		AuthorName: a.Name,
		AuthorSlug: a.Slug,
		SourceLink: io.SourceLink,
	}

	i, err := idea.New(ctx, is, opt)
	if err != nil {
		return nil, fmt.Errorf("couldn't create idea for analyst: %w", err)
	}

	return i, nil
}

type ideaFinder interface {
	FindByAnalystSlug(ctx context.Context, slug string) ([]*idea.Idea, error)
}

func (a *Analyst) Ideas(ctx context.Context, idf ideaFinder) ([]*idea.Idea, error) {
	ii, err := idf.FindByAnalystSlug(ctx, a.Slug)
	if err != nil {
		return ii, fmt.Errorf("couldn't find ideas for analyst (slug %q): %w", a.Slug, err)
	}
	return ii, err
}
