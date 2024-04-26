package instrument

import (
	"context"
	"fmt"

	"github.com/greatcloak/decimal"
)

type Instrument struct {
	Name   string
	Ticker string
}

type Quoted struct {
	Instrument
	Price decimal.Decimal
}

type priceProvider interface {
	Price(ctx context.Context, i *Instrument) (decimal.Decimal, error)
}

func (i *Instrument) Price(ctx context.Context, pp priceProvider) (decimal.Decimal, error) {
	return pp.Price(ctx, i)
}

func (i *Instrument) Quote(ctx context.Context, pp priceProvider) (Quoted, error) {
	price, err := i.Price(ctx, pp)
	if err != nil {
		return Quoted{}, fmt.Errorf("couldn't get instrument price: %w", err)
	}

	return Quoted{
		Instrument: *i,
		Price:      price,
	}, nil
}
