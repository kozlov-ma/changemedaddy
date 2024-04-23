package idea

import (
	"changemedaddy/internal/model"
	"context"
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
	Update(ctx context.Context, id int, idea *model.Idea) error
}

type service struct {
	slug slugger
	repo ideaRepository
	log  slog.Logger
}

const svcTimeout = time.Second * 2

func (s *service) NewService(slug slugger, repo ideaRepository, market marketSvc, log slog.Logger) service {
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
		return nil, err
	}

	i := &model.Idea{
		Slug:      s.slug.Slug(req.Name), // TODO validate unique
		Positions: pp,
		Deadline:  req.Deadline, // TODO validate
	}

	if err := s.repo.Create(ctx, i); err != nil {
		return nil, err
	}

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
			OpenDate:    time.Now(),
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

	return s.repo.FindOne(ctx, req)
}

func (s *service) Update(ctx context.Context, idea *model.Idea) error {
	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	return s.repo.Update(ctx, idea.ID, idea)
}
