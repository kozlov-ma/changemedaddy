package position

import (
	"context"
	"log/slog"
)

type (
	Repository interface {
		// Find returns a position. Note that every time a different
		// copy of a Position is loaded. Returns nil if the position is not found.
		Find(ctx context.Context, analystSlug string, positionSlug string) (*Position, error)

		// Create creates a position in the repository, and assigns it a new ID.
		// Returns a pointer to the new position with.
		Create(ctx context.Context, p *Position) (*Position, error)

		// Update updates a position in the repository. Returns a pointer to the updated position.
		// Returns nil if the position is not found.
		Update(ctx context.Context, p *Position) (*Position, error)
	}

	Service struct {
		log  *slog.Logger
		repo Repository
	}
)

func NewService(log *slog.Logger, repo Repository) *Service {
	return &Service{
		log:  log.With("service", "position"),
		repo: repo,
	}
}

// Find returns a position by its ID. Returns nil if the position is not found.
func (s *Service) Find(ctx context.Context, analystSlug string, positionSlug string) (*Position, error) {
	p, err := s.repo.Find(ctx, analystSlug, positionSlug)
	if err != nil {
		s.log.Error("repository error", "error", err)
	}
	return p, err
}

// Create creates a new position in the repository.
// Returns a pointer to the new position.
func (s *Service) Create(ctx context.Context, p *Position) (*Position, error) {
	p, err := s.repo.Create(ctx, p)
	if err != nil {
		s.log.Error("repository error", "error", err)
	}
	return p, err
}

// Update updates a position in the repository. Returns a pointer to the updated position.
// Returns nil if the position is not found.
func (s *Service) Update(ctx context.Context, p *Position) (*Position, error) {
	p, err := s.repo.Update(ctx, p)
	if err != nil {
		s.log.Error("repository error", "error", err)
	}

	return p, err
}
