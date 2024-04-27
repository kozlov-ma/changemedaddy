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

type WithPrice struct {
	*Instrument
	Price decimal.Decimal
}

type priceProvider interface {
	Price(ctx context.Context, i *Instrument) (decimal.Decimal, error)
}

func (i *Instrument) WithPrice(ctx context.Context, pp priceProvider) (WithPrice, error) {
	price, err := pp.Price(ctx, i)
	if err != nil {
		return WithPrice{}, fmt.Errorf("couldn't get instrument price: %w", err)
	}

	return WithPrice{
		Instrument: i,
		Price:      price,
	}, nil
}
