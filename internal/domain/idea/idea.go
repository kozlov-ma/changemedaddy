package idea

import (
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/domain/position"
	"context"
	"time"

	"github.com/greatcloak/decimal"
	"golang.org/x/sync/errgroup"
)

type (
	Idea struct {
		CreatedBySlug string `bson:"created_by_slug"`
		Slug          string `bson:"slug"`

		Positions []*position.Position `bson:"positions"`

		SourceLink string `bson:"source_link"`

		Deadline time.Time `bson:"deadline"`
		OpenDate time.Time `bson:"open_date"`
	}
)

type marketProvider interface {
	Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
}

func (i *Idea) ProfitP(ctx context.Context, mp marketProvider) (decimal.Decimal, error) {
	eg, ctx := errgroup.WithContext(ctx)
	profits := make(chan decimal.Decimal, len(i.Positions))
	for _, p := range i.Positions {
		eg.Go(func() error {
			profit, err := p.ProfitP(ctx, mp)
			if err != nil {
				return err
			}
			profits <- profit
			return nil
		})
	}
	err := eg.Wait()
	if err != nil {
		return decimal.Zero, err
	}

	close(profits)
	var totalProfit decimal.Decimal
	for profit := range profits {
		totalProfit = totalProfit.Add(profit)
	}

	return totalProfit, nil
}
