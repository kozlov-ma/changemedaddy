package update

import (
	"context"
	"log/slog"

	"github.com/go-chi/chi/v5/middleware"

	"changemedaddy/internal/app/position"
)

type Repository interface {
	Create(ctx context.Context, u *Update) (*Update, error)
	FindByPositionID(ctx context.Context, positionID string) ([]*Update, error)
}

type Service struct {
	repo      Repository
	positions *position.Service
	log       *slog.Logger
}

func NewService(log *slog.Logger, repo Repository, positions *position.Service) *Service {
	return &Service{
		repo:      repo,
		positions: positions,
		log:       log.With("service", "update"),
	}
}

func (s *Service) UpdatePosition(ctx context.Context, pos *position.Position, u *Update) (*position.Position, error) {
	// TODO это всё нужно сделать в рамках одной транзакции. Понадобится поменять интерфейсы
	u, err := s.repo.Create(ctx, u)
	if err != nil {
		s.log.Error("repository error", "error", err)
	}

	if pos, err = u.Apply(pos); err != nil {
		s.log.Info("position update apply error", "error", err, "id", ctx.Value(middleware.RequestIDKey))
	}

	pos, err = s.positions.Update(ctx, pos)
	if err != nil {
		s.log.Error("position update error", "error", err, "id", ctx.Value(middleware.RequestIDKey))
	}

	return pos, err
}

func (s *Service) FindByPosition(ctx context.Context, pos *position.Position) ([]*Update, error) {
	return s.repo.FindByPositionID(ctx, pos.ID)
}

func (s *Service) Create(ctx context.Context, u *Update) (*Update, error) {
	return s.repo.Create(ctx, u)
}
