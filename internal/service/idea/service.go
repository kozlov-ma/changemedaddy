package idea

import (
	"changemedaddy/internal/domain/analyst"
	"changemedaddy/internal/domain/idea"
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/greatcloak/decimal"
	"golang.org/x/sync/errgroup"
)

type slugger interface {
	Slug(string) string
}

type ideaRepository interface {
	Create(ctx context.Context, idea *idea.Idea) error
	FindOne(ctx context.Context, analystSlug, ideaSlug string) (*idea.Idea, error)
}

type marketProvider interface {
	Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
	Instrument(ctx context.Context, ticker string) (*instrument.Instrument, error)
}

type analystProvider interface {
	FindBySlug(ctx context.Context, slug string) (*analyst.Analyst, error)
}

type service struct {
	slug    slugger
	ideas   ideaRepository
	instr   marketProvider
	analyst analystProvider
	log     *slog.Logger
}

const svcTimeout = time.Second * 2

func NewService(slug slugger, repo ideaRepository, instr marketProvider, analyst analystProvider, log *slog.Logger) service {
	log = log.With("service", "idea")
	return service{
		slug:    slug,
		ideas:   repo,
		instr:   instr,
		analyst: analyst,
		log:     log,
	}
}

func (s *service) Create(ctx context.Context, req CreateIdeaRequest) (*idea.Idea, error) {

	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	analyst, err := s.analyst.FindBySlug(ctx, req.CreatedBySlug)
	if err != nil {
		return nil, fmt.Errorf("couldn't get analyst: %w", err)
	}

	pp, err := s.createPositions(ctx, req.Positions)
	if err != nil {
		return nil, fmt.Errorf("couldn't create positions: %w", err)
	}

	i := &idea.Idea{
		Analyst:    analyst,
		Slug:       s.slug.Slug(req.Name),
		Positions:  pp,
		SourceLink: req.SourceLink,
		Deadline:   req.Deadline,
		OpenDate:   time.Now(),
	}

	if err := s.ideas.Create(ctx, i); err != nil {
		return nil, fmt.Errorf("couldn't create idea: %w", err)
	}

	s.log.DebugContext(ctx, "created new idea", "analystSlug", analyst.Slug, "slug", i.Slug)
	return i, nil
}

func (s *service) createPositions(ctx context.Context, rr []CreatePositionRequest) ([]*position.Position, error) {
	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	var (
		pp    = make(chan *position.Position, len(rr))
		parts = make(chan int, len(rr))
	)

	eg, ectx := errgroup.WithContext(ctx)
	for i, p := range rr {
		i, p := i, p
		eg.Go(func() error {
			instr, err := s.instr.Instrument(ectx, p.Ticker)
			if err != nil {
				return fmt.Errorf("couldn't find instrument: %w", err)
			}

			pp <- &position.Position{
				Idx:         i,
				Instrument:  instr,
				Type:        p.Type,
				Status:      position.Active,
				StartPrice:  p.StartPrice,
				TargetPrice: p.TargetPrice,
			}
			parts <- p.IdeaPart

			return nil
		})
	}
	err := eg.Wait()
	if err != nil {
		return nil, fmt.Errorf("couldn't create positions: %w", err)
	}
	close(pp)
	close(parts)

	positions := make([]*position.Position, 0, len(pp))
	var partsSum decimal.Decimal
	for len(pp) > 0 && len(parts) > 0 {
		positions = append(positions, <-pp)
		partsSum = partsSum.Add(decimal.NewFromInt(int64(<-parts)))
	}

	for i := range positions {
		positions[i].IdeaPart = decimal.NewFromInt(int64(rr[i].IdeaPart)).Div(partsSum)
	}

	return positions, nil
}

func (s *service) Page(ctx context.Context, req FindRequest) (*IdeaResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	analyst, err := s.analyst.FindBySlug(ctx, req.CreatedBySlug)
	if err != nil {
		s.log.ErrorContext(ctx, "couldn't find analyst", "err", err)
		return nil, fmt.Errorf("couldn't find analyst: %w", err)
	} else if analyst == nil {
		s.log.DebugContext(ctx, "couldn't find analyst", "slug", req.CreatedBySlug)
		return nil, nil
	}

	i, err := s.ideas.FindOne(ctx, analyst.Slug, req.Slug)
	if err != nil {
		s.log.ErrorContext(ctx, "couldn't find idea", "err", err)
		return nil, fmt.Errorf("couldn't find idea: %w", err)
	} else if i == nil {
		s.log.DebugContext(ctx, "couldn't find idea", "analystSlug", req.CreatedBySlug, "slug", req.Slug)
		return nil, nil
	}

	s.log.DebugContext(ctx, "found idea", "slug", i.Slug)

	ir := &IdeaResponse{
		Idea:      i,
		Positions: make([]PositionResponse, len(i.Positions)),
	}

	eg, ectx := errgroup.WithContext(ctx)
	for j, p := range i.Positions {
		j, p := j, p
		eg.Go(func() error {
			price, err := p.Instrument.Price(ectx, s.instr)
			if err != nil {
				s.log.ErrorContext(ectx, "couldn't get price", "err", err)
				return err
			}
			profitP := price.Sub(p.StartPrice).Div(p.StartPrice).Mul(decimal.NewFromInt(100))

			ir.Positions[j] = PositionResponse{
				Position: p,
				ProfitP:  profitP,
				CurPrice: price,
			}
			return nil
		})
	}
	if err := eg.Wait(); err != nil {
		s.log.ErrorContext(ctx, "couldn't get prices", "err", err)
		return nil, fmt.Errorf("couldn't get prices: %w", err)
	}

	profitP, err := i.ProfitP(ctx, s.instr)
	if err != nil {
		s.log.ErrorContext(ctx, "couldn't get profit", "err", err)
		return nil, fmt.Errorf("couldn't get profit: %w", err)
	}
	ir.ProfitP = profitP

	return ir, nil
}
