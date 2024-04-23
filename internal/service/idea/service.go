package idea

import (
	"changemedaddy/internal/model"
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/shopspring/decimal"
)

type slugger interface {
	Slug(string) string
}

type ideaRepository interface {
	Create(ctx context.Context, idea *model.Idea) error
	FindOne(ctx context.Context, req FindRequest) (*model.Idea, error)
	Update(ctx context.Context, idea *model.Idea) error
}

type service struct {
	slug slugger
	repo ideaRepository
	log  *slog.Logger
}

const svcTimeout = time.Second * 2

func NewService(slug slugger, repo ideaRepository, log *slog.Logger) service {
	log = log.With("service", "idea")
	return service{
		slug: slug,
		repo: repo,
		log:  log,
	}
}

func (s *service) Create(ctx context.Context, req CreateIdeaRequest) (*model.Idea, error) {
	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	pp, err := s.createPositions(ctx, req.Positions)
	if err != nil {
		s.log.ErrorContext(ctx, "couldn't create positions", "err", err)
		return nil, fmt.Errorf("couldn't create positions: %w", err)
	}

	i := &model.Idea{
		Slug:      s.slug.Slug(req.Name), // TODO validate unique
		Positions: pp,
		Deadline:  req.Deadline, // TODO validate
		OpenDate:  time.Now(),
	}

	if err := s.repo.Create(ctx, i); err != nil {
		s.log.ErrorContext(ctx, "couldn't create idea", "err", err)
		return nil, fmt.Errorf("couldn't create idea: %w", err)
	}

	s.log.InfoContext(ctx, "created new idea", "id", i.ID)
	return i, nil
}

func (s *service) createPositions(ctx context.Context, rr []CreatePositionRequest) ([]model.Position, error) {
	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	var (
		pp       = make([]model.Position, len(rr))
		partsSum decimal.Decimal
	)

	for i, p := range rr {
		pp[i] = model.Position{
			ID:          i,
			Ticker:      p.Ticker, // TODO validate that is real
			Type:        p.Type,   // TODO validate
			Status:      model.StatusActive,
			AvgPrice:    p.AvgPrice,        // TODO validate
			TargetPrice: p.TargetPrice,     // TODO validate
			IdeaPart:    decimal.Decimal{}, // do not forget
		}

		partsSum = partsSum.Add(decimal.NewFromInt(int64(p.IdeaPart)))
	}

	for i := range pp {
		pp[i].IdeaPart = decimal.NewFromInt(int64(rr[i].IdeaPart)).Div(partsSum)
	}

	return pp, nil
}

func (s *service) FindOne(ctx context.Context, req FindRequest) (*model.Idea, error) {
	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	i, err := s.repo.FindOne(ctx, req)
	if err != nil {
		s.log.ErrorContext(ctx, "couldn't find idea", "err", err)
		return i, fmt.Errorf("couldn't find idea: %w", err)
	}

	if i == nil {
		s.log.InfoContext(ctx, "tried to find ideas, found none", "filter", req)
	}

	s.log.DebugContext(ctx, "found idea", "id", i.ID, "filter", req)
	return i, err
}

func (s *service) Update(ctx context.Context, idea *model.Idea) error {
	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	err := s.repo.Update(ctx, idea)
	if err != nil {
		s.log.ErrorContext(ctx, "couldn't update idea", "err", err)
		return fmt.Errorf("couldn't update idea: %w", err)
	}

	s.log.InfoContext(ctx, "updated idea", "id", idea.ID)
	return nil
}
