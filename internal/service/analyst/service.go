package analyst

import (
	"changemedaddy/internal/domain/analyst"
	"context"
)

type fakeService struct{}

func NewFakeService() *fakeService {
	return &fakeService{}
}

func (s *fakeService) FindBySlug(_ context.Context, slug string) (*analyst.Analyst, error) {
	if slug == "cumming-soon" {
		return &analyst.Analyst{
			Name: "Coming Soon",
			Slug: "cumming-soon",
		}, nil
	}

	return nil, nil
}
