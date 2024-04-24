package analystrepo

import (
	"changemedaddy/internal/domain/analyst"
	"context"
)

type fakeRepo struct{}

func NewFake() *fakeRepo {
	return &fakeRepo{}
}

func (s *fakeRepo) FindBySlug(_ context.Context, slug string) (*analyst.Analyst, error) {
	if slug == "cumming-soon" {
		return &analyst.Analyst{
			Name: "Coming Soon",
			Slug: "cumming-soon",
		}, nil
	}

	return nil, nil
}
