package ideapage

import (
	"changemedaddy/internal/model"
	"changemedaddy/internal/pkg/assert"
	"changemedaddy/internal/service/idea"
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/shopspring/decimal"
)

type (
	ideaProvider interface {
		FindOne(ctx context.Context, req idea.FindRequest) (*model.Idea, error)
	}

	marketProvider interface {
		Instrument(ctx context.Context, ticker string) (*model.Instrument, error)
	}
)

type service struct {
	ideas  ideaProvider
	market marketProvider
	log    *slog.Logger
}

const svcTimeout = time.Second * 2

func NewService(ideas ideaProvider, market marketProvider, log *slog.Logger) *service {
	log = log.With("service", "ideapage")
	return &service{
		ideas:  ideas,
		market: market,
		log:    log,
	}
}

func (s *service) Page(ctx context.Context, req FindPageRequest) (*Page, error) {
	ctx, cancel := context.WithTimeout(ctx, svcTimeout)
	defer cancel()

	i, err := s.ideas.FindOne(ctx, idea.FindRequest{
		Slug: req.IdeaSlug,
	})

	if err != nil {
		s.log.ErrorContext(ctx, "couldn't find idea", "filter", req, "err", err)
		return nil, err
	}
	if i == nil {
		s.log.InfoContext(ctx, "couldn't find idea", "filter", req)
		return nil, nil
	}

	pp := make([]Position, 0, len(i.Positions))
	var profitP decimal.Decimal
	for _, p := range i.Positions {
		instr, err := s.market.Instrument(ctx, p.Ticker)
		if err != nil {
			s.log.ErrorContext(ctx, "couldn't get instrument", "ticker", p.Ticker, "err", err)
			return nil, err
		}

		assert.That(instr != nil, fmt.Sprintf("instrument for trusted ticker %q was not found", p.Ticker))

		profitP = profitP.Add(instr.CurPrice.Sub(p.TargetPrice).Div(p.StartPrice).Mul(decimal.NewFromInt(100)))
		pp = append(pp, Position{
			Name:        instr.Name,
			Ticker:      instr.Ticker,
			CurPrice:    instr.CurPrice.String(),
			ProfitP:     profitP.String(),
			StartPrice:  p.StartPrice.String(),
			TargetPrice: p.TargetPrice.String(),
		})
	}

	return &Page{
		CreatedBy: "Analysts will be added soon",
		OpenDate:  i.OpenDate.Format("02.01.2006"),
		Deadline:  i.Deadline.Format("02.01.2006"),
		ProfitP:   profitP.String(),
		Positions: pp,
	}, nil
}
